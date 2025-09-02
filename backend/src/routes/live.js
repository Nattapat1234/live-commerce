import { Router } from "express";
import { str, posInt } from "../utils/validate.js";

export function makeLiveRouter({ db, pollerService }) {
  const router = Router();

  /** รายการ live sessions */
  router.get("/live-sessions", async (_req, res, next) => {
    try {
      const r = await db.query(
        "SELECT id, page_id, video_id, status, started_at, ended_at FROM live_sessions ORDER BY id DESC"
      );
      res.json(r.rows);
    } catch (e) { next(e); }
  });
  router.get("/live-sessions/:id/history", async (req, res, next) => {
  try {
    const liveSessionId = posInt(req.params.id, "live_session_id");
    const status = String(req.query.status || "all").toLowerCase();
    const q = String(req.query.q || "").trim();
    const limit = Math.min(posInt(req.query.limit || 50, "limit"), 200);

    // map สถานะ
    let statuses = ["reserved", "confirmed", "cancelled", "expired"];
    if (status !== "all") statuses = [status];

    const params = [liveSessionId];
    let where = `live_session_id=$1 AND status = ANY($2)`;
    params.push(statuses);

    if (q) {
      params.push(`%${q}%`);
      where += ` AND (LOWER(sku) LIKE LOWER($${params.length}) OR LOWER(name) LIKE LOWER($${params.length}) OR LOWER(user_name) LIKE LOWER($${params.length}))`;
    }

    params.push(limit);
    const sql = `
      SELECT r.id, r.product_id, r.user_name, r.position_in_queue, r.status,
             r.created_at, r.confirmed_at, r.cancelled_at, r.expires_at,
             p.sku, p.name
      FROM reservations r
      JOIN products p ON p.id = r.product_id
      WHERE ${where}
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT $${params.length}
    `;
    const rows = await req.app.locals.db.query(sql, params);
    res.json({ items: rows.rows });
  } catch (e) { next(e); }
});

  /** สร้าง live session */
  router.post("/live-sessions", async (req, res, next) => {
    try {
      const page_id = str(req.body.page_id, "page_id");
      const video_id = str(req.body.video_id, "video_id");
      const r = await db.query(
        "INSERT INTO live_sessions(page_id, video_id, status) VALUES($1,$2,'live') RETURNING *",
        [page_id, video_id]
      );
      res.status(201).json(r.rows[0]);
    } catch (e) { next(e); }
  });

  /** เริ่ม poller */
  router.post("/live-sessions/:id/start", async (req, res, next) => {
    try {
      const id = posInt(req.params.id, "id");
      const out = await pollerService.start(id);
      res.json({ ok: true, ...out });
    } catch (e) { next(e); }
  });

  /** หยุด poller */
  router.post("/live-sessions/:id/stop", async (req, res, next) => {
    try {
      const id = posInt(req.params.id, "id");
      const out = pollerService.stop(id);
      res.json({ ok: true, ...out });
    } catch (e) { next(e); }
  });

  /** คิวสรุป + รายการล่าสุด (แบบเดิม) */
  router.get("/live-sessions/:id/queue", async (req, res, next) => {
    try {
      const id = posInt(req.params.id, "id");
      const summary = await db.query(
        `SELECT r.product_id, p.sku, p.name,
                COUNT(*) FILTER (WHERE r.status='reserved') AS reserved_count
         FROM reservations r
         JOIN products p ON p.id=r.product_id
         WHERE r.live_session_id=$1
         GROUP BY r.product_id, p.sku, p.name
         ORDER BY p.name`,
        [id]
      );
      const rows = await db.query(
        `SELECT r.id, r.product_id, r.user_name, r.position_in_queue, r.status
         FROM reservations r
         WHERE r.live_session_id=$1
         ORDER BY r.id DESC
         LIMIT 200`,
        [id]
      );
      res.json({ summary: summary.rows, queue: rows.rows });
    } catch (e) { next(e); }
  });

  /**
   * NEW: ประวัติการจองทั้งหมดของ live session
   * GET /live-sessions/:id/reservations?status=all|reserved|confirmed|canceled|expired&limit=200&q=keyword
   * - join products ให้ได้ sku,name
   * - เรียงใหม่สุดก่อน (ใช้ id DESC เพื่อกันกรณีไม่มี created_at)
   */
  router.get("/live-sessions/:id/reservations", async (req, res, next) => {
    try {
      const id = posInt(req.params.id, "id");
      const status = (req.query.status || "all").toString().toLowerCase();
      const limit = Math.max(1, Math.min(500, Number(req.query.limit) || 200));
      const q = (req.query.q || "").toString().trim().toLowerCase();

      const where = ["r.live_session_id = $1"];
      const params = [id];
      let idx = 2;

      if (["reserved","confirmed","canceled","expired"].includes(status)) {
        where.push(`r.status = $${idx++}`);
        params.push(status);
      }

      if (q) {
        where.push(`(
          LOWER(p.sku) LIKE $${idx} OR
          LOWER(p.name) LIKE $${idx} OR
          LOWER(COALESCE(r.user_name,'')) LIKE $${idx}
        )`);
        params.push(`%${q}%`);
        idx++;
      }

      const sql = `
        SELECT
          r.id, r.product_id, p.sku, p.name AS product_name,
          r.user_name, r.position_in_queue, r.status,
          r.expires_at, r.confirmed_at, r.canceled_at,
          ${/* เผื่อไม่มี created_at ใน schema เดิม ให้ใช้ NULL แทน */""}
          ${/* ถ้ามีคอลัมน์ created_at จะถูกอ่านได้เลย */""}
          ${/* ถ้าไม่มีจะเป็น NULL และไม่กระทบการทำงาน */""}
          r.created_at
        FROM reservations r
        JOIN products p ON p.id = r.product_id
        WHERE ${where.join(" AND ")}
        ORDER BY r.id DESC
        LIMIT ${limit}
      `;

      const r = await db.query(sql, params);
      res.json(r.rows);
    } catch (e) { next(e); }
  });

  /**
   * (ถ้าคุณใช้ backfill) — คง endpoint นี้ไว้เหมือนเดิม
   * POST /live-sessions/:id/backfill?minutes=180
   * ให้ pollerService.backfillOnce ทำงานภายใน
   */
  router.post("/live-sessions/:id/backfill", async (req, res, next) => {
    try {
      const id = posInt(req.params.id, "id");
      const minutes = Math.max(1, Math.min(1440, Number(req.query.minutes) || 120));
      if (typeof pollerService.backfillOnce !== "function") {
        throw new Error("pollerService.backfillOnce is not implemented");
      }
      const out = await pollerService.backfillOnce(id, minutes);
      res.json({ ok: true, ...out });
    } catch (e) { next(e); }
  });

  return router;
}
