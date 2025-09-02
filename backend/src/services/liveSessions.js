export class LiveSessionService {
  constructor({ db, fbClient, pollerService }) {
    this.db = db;
    this.fb = fbClient;
    this.poller = pollerService;
  }

  async ensureLiveAndStartByPage(pageId) {
    // หา live ปัจจุบัน
    const live = await this.fb.findLiveVideoOnPage(pageId);
    if (!live?.id) {
      return { ok: false, reason: "not_live" };
    }
    const videoId = live.id;

    // หา/สร้าง live_sessions
    const existing = await this.db.query(
      "SELECT * FROM live_sessions WHERE page_id=$1 AND video_id=$2 AND status='live' ORDER BY id DESC LIMIT 1",
      [pageId, videoId]
    );
    let session;
    if (existing.rowCount) {
      session = existing.rows[0];
    } else {
      const ins = await this.db.query(
        "INSERT INTO live_sessions(page_id, video_id, status) VALUES ($1,$2,'live') RETURNING *",
        [pageId, videoId]
      );
      session = ins.rows[0];
    }

    // เริ่ม poller (รองรับทั้งรูปแบบ start(id) และ startPoller({ liveSessionId }))
    if (typeof this.poller.start === "function") {
      await this.poller.start(session.id);
    } else if (typeof this.poller.startPoller === "function") {
      await this.poller.startPoller({ liveSessionId: session.id });
    }

    return { ok: true, session, video: live };
  }
  
}
