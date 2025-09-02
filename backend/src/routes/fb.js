import { Router } from "express";
import { Validator } from "../utils/validate.js";

export function makeFbRouter({ fbClient, liveSessionService }) {
  const router = Router();


  router.get("/whoami", async (_req, res) => {
    try {
      const me = await fbClient.whoAmI();
      res.json(me);
    } catch (e) {
      const status = e?.response?.status ?? 500;
      const msg = e?.response?.data?.error?.message || e?.message || "FB error";
      res.status(status).json({ error: msg });
    }
  });

  // ดูข้อมูลเพจ/ไอดี
  router.get("/page-info", async (req, res) => {
    try {
      const id = Validator.str(req.query.id, "id");
      const info = await fbClient.getPageInfo(id);
      res.json(info);
    } catch (e) {
      const status = e?.response?.status ?? 500;
      const msg = e?.response?.data?.error?.message || e?.message || "FB error";
      res.status(status).json({ error: msg });
    }
  });

  // GET /fb/videos?page_id=...&type=all|uploaded  (page_id ว่างได้ → ใช้ 'me')
  router.get("/videos", async (req, res) => {
    try {
      const pageId = (req.query.page_id && String(req.query.page_id).trim()) || "me";
      const typeRaw = (req.query.type || "").toString().toLowerCase();
      const type = typeRaw === "uploaded" ? "uploaded" : undefined; // 'all' ⇒ ไม่ส่ง type

      const rows = await fbClient.fetchPageVideos({ pageId, limit: 50, type });
      res.json(
        (rows || []).map((v) => ({
          id: v.id,
          description: v.description,
          created_time: v.created_time,
          permalink_url: v.permalink_url,
          live_status: v.live_status,
          raw: v,
        }))
      );
    } catch (e) {
      const status = e?.response?.status ?? 500;
      const msg = e?.response?.data?.error?.message || e?.message || "FB error";
      console.error("[/fb/videos] error:", e?.response?.data || e);
      res.status(status).json({ error: msg });
    }
  });

  // GET /fb/live-current?page_id=... (page_id ว่างได้ → ใช้ 'me')
  router.get("/live-current", async (req, res) => {
    try {
      const pageId = (req.query.page_id && String(req.query.page_id).trim()) || "me";
      const live = await fbClient.findLiveVideoOnPage(pageId);
      res.json({ live: !!live, video: live });
    } catch (e) {
      const status = e?.response?.status ?? 500;
      const msg = e?.response?.data?.error?.message || e?.message || "FB error";
      console.error("[/fb/live-current] error:", e?.response?.data || e);
      res.status(status).json({ error: msg });
    }
  });

  // POST /fb/auto-start  { page_id? } (ว่างได้ → 'me')
  router.post("/auto-start", async (req, res) => {
    try {
      const pageId = (req.body.page_id && String(req.body.page_id).trim()) || "me";
      const out = await liveSessionService.ensureLiveAndStartByPage(pageId);
      if (!out.ok) return res.status(404).json({ ok: false, error: out.reason });
      res.json(out);
    } catch (e) {
      const status = e?.response?.status ?? 500;
      const msg = e?.response?.data?.error?.message || e?.message || "FB error";
      console.error("[/fb/auto-start] error:", e?.response?.data || e);
      res.status(status).json({ error: msg });
    }
  });

  return router;
}
