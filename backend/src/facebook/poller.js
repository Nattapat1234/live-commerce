// backend/src/facebook/poller.js
const REGISTRY = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class PollerService {
  constructor({ db, fbClient, reservationService, useSSE = false }) {
    this.db = db;
    this.fb = fbClient;
    this.resv = reservationService;
    this.useSSE = useSSE;
  }

  async start(liveSessionId) {
    if (REGISTRY.has(liveSessionId)) return { running: true };
    const r = await this.db.query("SELECT * FROM live_sessions WHERE id=$1", [liveSessionId]);
    if (!r.rowCount) throw new Error("live_session not found");
    const session = r.rows[0];

    const ctrl = { stop: false, mode: this.useSSE ? "sse+poll" : "poll" };
    REGISTRY.set(liveSessionId, ctrl);

    // 1) ตรวจ live + หา postId ที่อ้างถึง video นี้
    let isLive = false;
    let mappedPostId = null;
    try {
      const meta = await this.fb.getVideoMeta?.(session.video_id);
      isLive = (meta?.live_status || "").toLowerCase() === "live";
    } catch (e) {
      console.warn("[poll] getVideoMeta error:", e?.message || e);
    }
    try {
      mappedPostId = await this.fb.findPostIdForVideo({
        pageId: session.page_id,
        videoId: session.video_id,
      });
      if (mappedPostId) console.log("[poll] mapped postId:", mappedPostId);
    } catch (e) {
      console.warn("[poll] map post error:", e?.message || e);
    }

    // 2) ถ้า live และเปิดใช้ SSE ⇒ เปิดสตรีมควบคู่กับ polling
    let es = null;
    if (isLive && this.useSSE && this.fb.openLiveCommentsSSE) {
      try {
        es = this.fb.openLiveCommentsSSE(
          session.video_id,
          async (evt) => {
            const commentId = evt?.id;
            const from = evt?.from;
            const message = evt?.message;
            if (!message || !commentId) return;
            try {
              await this.resv.createFromComment({
                liveSessionId,
                message,
                userName: from?.name,
                userId: from?.id,
                commentId,
              });
            } catch (e) {
              if (String(e?.code) !== "23505") console.error("[SSE] err:", e?.message || e);
            }
          },
          (err) => console.error("[SSE] error:", err?.message || err)
        );
      } catch (e) {
        console.warn("[SSE] open error => fallback poll only:", e?.message || e);
      }
    }

    // 3) Poll ทั้ง video_id และ post_id (ถ้ามี)
    (async () => {
      let sinceTs = Date.now() - 60_000;
      let backoff = 1500;

      while (!ctrl.stop) {
        try {
          const [fromVideo, fromPost] = await Promise.all([
            this.fb.fetchComments({ objectId: session.video_id, sinceTs }).catch(() => ({ items: [] })),
            mappedPostId
              ? this.fb.fetchComments({ objectId: mappedPostId, sinceTs }).catch(() => ({ items: [] }))
              : Promise.resolve({ items: [] }),
          ]);

          const combined = [...(fromVideo.items || []), ...(fromPost.items || [])];
          // เก็บตามเวลาจริง: เก่า -> ใหม่
          combined.sort((a, b) => new Date(a.created_time) - new Date(b.created_time));

          for (const c of combined) {
            try {
              await this.resv.createFromComment({
                liveSessionId,
                message: c?.message,
                userName: c?.from?.name,
                userId: c?.from?.id,
                commentId: c?.id,
              });
            } catch (e) {
              if (String(e?.code) !== "23505") console.error("[poll] insert err:", e?.message || e);
            }
          }

          console.log(`[poll] got comments: video=${fromVideo.items?.length || 0}, post=${fromPost.items?.length || 0}`);
          sinceTs = Date.now();
          backoff = 1500;
        } catch (e) {
          console.error("[poll] error:", e?.response?.data || e?.message || e);
          backoff = Math.min(backoff * 2, 15000);
        }
        await sleep(backoff);
      }
    })();

    ctrl.stopFn = () => {
      ctrl.stop = true;
      if (es && es.close) try { es.close(); } catch {}
    };
    return { running: true, mode: es ? "sse+poll" : "poll" };
  }

  stop(liveSessionId) {
    const ctrl = REGISTRY.get(liveSessionId);
    if (!ctrl) return { running: false };
    ctrl.stop = true;
    ctrl.stopFn && ctrl.stopFn();
    REGISTRY.delete(liveSessionId);
    return { stopped: true };
  }

  // ===== NEW: backfill ดึงย้อนหลังจากทั้ง video และ post =====
  async backfillOnce(liveSessionId, minutes = 120) {
    const r = await this.db.query(
      "SELECT page_id, video_id FROM live_sessions WHERE id=$1",
      [liveSessionId]
    );
    if (!r.rowCount) throw new Error("live_session not found");
    const { page_id, video_id } = r.rows[0];

    const sinceTs = Date.now() - Math.max(1, Number(minutes)) * 60 * 1000;

    let postId = null;
    try {
      postId = await this.fb.findPostIdForVideo({ pageId: page_id, videoId: video_id });
      if (postId) console.log("[backfill] mapped postId:", postId);
    } catch (e) {
      console.warn("[backfill] map post error:", e?.message || e);
    }

    let pages = 0, imported = 0;

    const drain = async (objectId) => {
      if (!objectId) return;
      let after = null;
      do {
        const out = await this.fb.fetchComments({ objectId, after, sinceTs });
        const items = out.items || [];
        // เก็บตามเวลาจริง: เก่า -> ใหม่
        for (let i = items.length - 1; i >= 0; i--) {
          const c = items[i];
          try {
            await this.resv.createFromComment({
              liveSessionId,
              message: c?.message,
              userName: c?.from?.name,
              userId: c?.from?.id,
              commentId: c?.id,
            });
            imported++;
          } catch (e) {
            if (String(e?.code) !== "23505") console.error("[backfill] insert err:", e?.message || e);
          }
        }
        after = out.paging?.cursors?.after ?? null;
        if (after) pages++;
      } while (after);
    };

    await drain(video_id);
    await drain(postId);

    return { ok: true, minutes: Math.max(1, Number(minutes)), pages, imported, postId };
  }
}
