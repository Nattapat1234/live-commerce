const SKU_TOKEN_RE = /^f?([a-z0-9_-]+)$/i;

export class ReservationService {
  constructor(db, lockManager, inventoryService) {
    this.db = db;
    this.lock = lockManager;
    this.inventory = inventoryService;
  }

  /**
   * ดึง sku จากข้อความคอมเมนต์:
   * - ตัดเป็น token ด้วยช่องว่าง
   * - ไล่เช็คแต่ละ token ถ้าตรงรูปแบบ (มี/ไม่มี F นำหน้า) ให้รีเทิร์น
   */
  static parseSku(message) {
    const text = String(message || "")
      .trim()
      .replace(/[^\p{L}\p{N}_\- ]/gu, " "); // กันอักขระพิเศษติดกับโค้ด
    const tokens = text.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const m = t.match(SKU_TOKEN_RE);
      if (m) return m[1].toLowerCase();
    }
    return null;
  }

  /**
   * สร้างใบจองจากคอมเมนต์:
   * - หา SKU
   * - หาสินค้า
   * - ล็อก per-product ด้วย Redis
   * - กันสต็อก 1 ชิ้น
   * - ใส่คิว position_in_queue ถัดไป
   * - ตั้งหมดอายุ 15 นาที
   */
  async createFromComment({ liveSessionId, message, userName, userId, commentId }) {
    const sku = ReservationService.parseSku(message);
    if (!sku) return { matched: false };

    const p = await this.db.query(
      "SELECT * FROM products WHERE lower(sku)=lower($1)",
      [sku]
    );
    if (!p.rowCount) return { matched: false, reason: "sku_not_found" };
    const productId = p.rows[0].id;

    const lockKey = `lock:product:${productId}`;
    let created = null;

    const locked = await this.lock.withLock(lockKey, 2000, async () => {
      // กันสต็อก (atomic ในระดับ DB row lock + update)
      const inv = await this.inventory.reserveOne(productId);
      if (!inv.ok) return;

      // หา position ถัดไป
      const next = await this.db.query(
        `SELECT COALESCE(MAX(position_in_queue),0)+1 AS pos
           FROM reservations
          WHERE live_session_id=$1 AND product_id=$2`,
        [liveSessionId, productId]
      );
      const pos = next.rows[0].pos;

      const r = await this.db.query(
        `INSERT INTO reservations(
           live_session_id, product_id, user_fb_id, user_name, comment_id,
           position_in_queue, status, expires_at
         )
         VALUES($1,$2,$3,$4,$5,$6,'reserved', now() + interval '15 minutes')
         RETURNING *`,
        [liveSessionId, productId, userId || null, userName || null, commentId, pos]
      );
      created = r.rows[0];
    });

    if (!locked)  return { matched: true, ok: false, reason: "locked" };
    if (!created) return { matched: true, ok: false, reason: "sold_out" };

    return { matched: true, ok: true, reservation: created };
  }

  /**
   * หมดอายุแล้วคืนสต็อก (เรียกจาก cron ทุก 1 นาที)
   */
  async expireAndRestore() {
    const expired = await this.db.query(
      `UPDATE reservations
          SET status='expired'
        WHERE status='reserved' AND expires_at < now()
        RETURNING id, product_id`
    );
    for (const row of expired.rows) {
      await this.inventory.restoreOne(row.product_id);
    }
    return expired.rowCount;
  }

  /**
   * ยืนยันออเดอร์ (จาก reserved -> confirmed)
   * - ตรวจว่าใบจองยังไม่หมดอายุ
   * - เปลี่ยนสถานะเป็น confirmed, ตรึงสต็อกไว้ (ไม่คืน)
   */
  async confirm(reservationId) {
    await this.db.query("BEGIN");
    try {
      const r = await this.db.query(
        "SELECT * FROM reservations WHERE id=$1 FOR UPDATE",
        [reservationId]
      );
      if (!r.rowCount) {
        await this.db.query("ROLLBACK");
        return { ok: false, code: 404, error: "not_found" };
      }
      const row = r.rows[0];

      // ถ้าหมดอายุแล้ว ให้ mark expired + คืนสต็อก
      if (row.status === "reserved" && row.expires_at && new Date(row.expires_at) <= new Date()) {
        await this.db.query(
          "UPDATE reservations SET status='expired' WHERE id=$1",
          [reservationId]
        );
        await this.inventory.restoreOne(row.product_id);
        await this.db.query("COMMIT");
        return { ok: false, code: 409, error: "expired" };
      }

      if (row.status !== "reserved") {
        await this.db.query("ROLLBACK");
        return { ok: false, code: 409, error: "invalid_status", status: row.status };
      }

      const u = await this.db.query(
        `UPDATE reservations
            SET status='confirmed', confirmed_at=now(), expires_at=NULL
          WHERE id=$1
          RETURNING *`,
        [reservationId]
      );

      await this.db.query("COMMIT");
      return { ok: true, reservation: u.rows[0] };
    } catch (e) {
      await this.db.query("ROLLBACK");
      throw e;
    }
  }

  /**
   * ยกเลิกออเดอร์ (จาก reserved -> canceled) แล้วคืนสต็อก
   */
  async cancel(reservationId, { reason } = {}) {
    await this.db.query("BEGIN");
    try {
      const r = await this.db.query(
        "SELECT * FROM reservations WHERE id=$1 FOR UPDATE",
        [reservationId]
      );
      if (!r.rowCount) {
        await this.db.query("ROLLBACK");
        return { ok: false, code: 404, error: "not_found" };
      }
      const row = r.rows[0];

      // ถ้าหมดอายุแล้ว ให้ mark expired + คืนสต็อก (กันรอ cron)
      if (row.status === "reserved" && row.expires_at && new Date(row.expires_at) <= new Date()) {
        await this.db.query(
          "UPDATE reservations SET status='expired' WHERE id=$1",
          [reservationId]
        );
        await this.inventory.restoreOne(row.product_id);
        await this.db.query("COMMIT");
        return { ok: false, code: 409, error: "expired" };
      }

      if (row.status !== "reserved") {
        await this.db.query("ROLLBACK");
        return { ok: false, code: 409, error: "invalid_status", status: row.status };
      }

      // ถ้ามีคอลัมน์ canceled_reason ก็อัปเดตเพิ่มได้ (ยังไม่ได้สร้างใน schema เริ่มต้น)
      const u = await this.db.query(
        `UPDATE reservations
            SET status='canceled', canceled_at=now()
          WHERE id=$1
          RETURNING *`,
        [reservationId]
      );

      await this.inventory.restoreOne(row.product_id);
      await this.db.query("COMMIT");
      return { ok: true, reservation: u.rows[0] };
    } catch (e) {
      await this.db.query("ROLLBACK");
      throw e;
    }
  }
}
