import { Router } from "express";
import { Validator } from "../utils/validate.js";

export function makeAdminRouter({ reservationService }) {
  const router = Router();

  // ยืนยันออเดอร์
  router.post("/reservations/:id/confirm", async (req, res, next) => {
    try {
      const id = Validator.posInt(req.params.id, "id");
      const out = await reservationService.confirm(id);
      if (!out.ok) return res.status(out.code || 400).json(out);
      res.json(out);
    } catch (e) { next(e); }
  });

  // ยกเลิก (คืนสต็อก)
  router.post("/reservations/:id/cancel", async (req, res, next) => {
    try {
      const id = Validator.posInt(req.params.id, "id");
      const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
      const out = await reservationService.cancel(id, { reason });
      if (!out.ok) return res.status(out.code || 400).json(out);
      res.json(out);
    } catch (e) { next(e); }
  });

  return router;
}
