import { Router } from "express";
import { Validator } from "../utils/validate.js";

// DIP: รับ service จากภายนอก (ไม่ new ในไฟล์)
export function makeProductsRouter({ productService }) {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      const rows = await productService.list();
      res.json(rows);
    } catch (e) { next(e); }
  });

  router.post("/", async (req, res, next) => {
    try {
      const sku = Validator.str(req.body.sku, "sku").toLowerCase();
      const name = Validator.str(req.body.name, "name");
      const price_cents = Validator.posInt(req.body.price_cents, "price_cents");
      const stock_total = Validator.posInt(req.body.stock_total, "stock_total");
      const item = await productService.create({ sku, name, price_cents, stock_total });
      res.status(201).json(item);
    } catch (e) {
      if (e?.code === "23505") return res.status(409).json({ error: "SKU already exists" });
      next(e);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const id = Validator.posInt(req.params.id, "id");
      const payload = {};
      if (req.body.name != null) payload.name = Validator.str(req.body.name, "name");
      if (req.body.price_cents != null) payload.price_cents = Validator.posInt(req.body.price_cents, "price_cents");
      if (req.body.is_active != null) payload.is_active = Boolean(req.body.is_active);
      if (req.body.restock != null) payload.restock = Validator.posInt(req.body.restock, "restock");

      const updated = await productService.patch(id, payload);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (e) { next(e); }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const id = Validator.posInt(req.params.id, "id");
      const ok = await productService.remove(id);
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.status(204).send();
    } catch (e) { next(e); }
  });

  return router;
}
