export class ProductService {
  constructor(db) { this.db = db; }

  async list() {
    const r = await this.db.query(
      "SELECT id, sku, name, price_cents, stock_total, stock_available, is_active FROM products ORDER BY id DESC"
    );
    return r.rows;
  }

  async create({ sku, name, price_cents, stock_total }) {
    const r = await this.db.query(
      `INSERT INTO products(sku, name, price_cents, stock_total, stock_available, is_active)
       VALUES($1, $2, $3, $4, $4, true) RETURNING *`,
      [sku.toLowerCase(), name, price_cents, stock_total]
    );
    return r.rows[0];
  }

  async patch(id, { name, price_cents, is_active, restock }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (name != null) { fields.push(`name = $${idx++}`); values.push(name); }
    if (price_cents != null) { fields.push(`price_cents = $${idx++}`); values.push(price_cents); }
    if (is_active != null) { fields.push(`is_active = $${idx++}`); values.push(Boolean(is_active)); }
    if (restock != null) {
      const n = Number(restock);
      if (!Number.isInteger(n) || n < 0) throw new Error("Invalid restock");
      fields.push(`stock_total = stock_total + ${n}`);
      fields.push(`stock_available = stock_available + ${n}`);
    }
    if (!fields.length) throw new Error("No fields to update");

    values.push(id);
    const r = await this.db.query(
      `UPDATE products SET ${fields.join(", ")} WHERE id=$${idx} RETURNING *`,
      values
    );
    return r.rows[0] || null;
  }

  async remove(id) {
    const r = await this.db.query("DELETE FROM products WHERE id=$1", [id]);
    return r.rowCount > 0;
  }
}

export class InventoryService {
  constructor(db) { this.db = db; }

  // ใช้ TRANSACTION + FOR UPDATE ป้องกัน race
  async reserveOne(productId) {
    const client = await this.db.getClient();
    try {
      await client.query("BEGIN");
      const r1 = await client.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [productId]);
      if (!r1.rowCount) { await client.query("ROLLBACK"); throw new Error("Product not found"); }
      const p = r1.rows[0];
      if (p.stock_available <= 0) { await client.query("ROLLBACK"); return { ok: false, reason: "sold_out" }; }
      await client.query("UPDATE products SET stock_available=stock_available-1 WHERE id=$1", [productId]);
      await client.query("COMMIT");
      return { ok: true };
    } catch (e) {
      try { await client.query("ROLLBACK"); } catch {}
      throw e;
    } finally {
      client.release();
    }
  }

  async restoreOne(productId) {
    await this.db.query("UPDATE products SET stock_available=stock_available+1 WHERE id=$1", [productId]);
  }
}
