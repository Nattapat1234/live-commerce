// backend/src/facebook/client.js
import axios from "axios";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

function loadEventSource() {
  const mod = require("eventsource");
  return mod?.default ?? mod?.EventSource ?? mod;
}

export class FBClient {
  constructor({ version, token }) {
    this.version = version || "v23.0";
    this.token = token;
    if (!this.token) console.warn("[FBClient] No access token provided.");
  }

  // ========= Utils =========
  async whoAmI() {
    if (!this.token) throw new Error("FB_PAGE_ACCESS_TOKEN not set");
    const url = `https://graph.facebook.com/${this.version}/me?fields=id,name&access_token=${this.token}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return data; // { id, name }
  }

  async getPageInfo(id) {
    if (!this.token) throw new Error("FB_PAGE_ACCESS_TOKEN not set");
    const fields = "id,name,link,about,can_post";
    const url = `https://graph.facebook.com/${this.version}/${id}?fields=${fields}&access_token=${this.token}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return data;
  }

  // ========= Comments (generic) =========
  // ใช้ได้กับทั้งวิดีโอ (video_id) และโพสต์ (post_id)
  async fetchComments({ objectId, after, sinceTs }) {
    if (!this.token) throw new Error("FB_PAGE_ACCESS_TOKEN not set");
    const params = new URLSearchParams({
      access_token: this.token,
      fields: "id,from{id,name},message,created_time",
      filter: "toplevel",
      order: "reverse_chronological",
      limit: "100",
    });
    if (after) params.set("after", after);
    if (sinceTs) params.set("since", Math.floor(sinceTs / 1000).toString());
    const url = `https://graph.facebook.com/${this.version}/${objectId}/comments?${params}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return { items: data?.data ?? [], paging: data?.paging ?? null };
  }

  // คงไว้เพื่อ backward-compat
  async fetchVideoComments({ videoId, afterCursor, sinceTs }) {
    return this.fetchComments({ objectId: videoId, after: afterCursor, sinceTs });
  }

  // ========= Video / Live Meta =========
  async getVideoMeta(videoId) {
    if (!this.token) throw new Error("FB_PAGE_ACCESS_TOKEN not set");
    const fields = "id,live_status,permalink_url,created_time";
    const url = `https://graph.facebook.com/${this.version}/${videoId}?fields=${fields}&access_token=${this.token}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return data || null;
  }

  // หา post ที่ attach วิดีโอนี้ (เพื่อดึงคอมเมนต์ใต้โพสต์ด้วย)
  async findPostIdForVideo({ pageId, videoId, maxPages = 5 }) {
    if (!this.token) throw new Error("FB_PAGE_ACCESS_TOKEN not set");
    let url = `https://graph.facebook.com/${this.version}/${pageId}/posts?fields=id,created_time,attachments{target{id},type}&limit=50&access_token=${this.token}`;
    let pages = 0;

    while (url && pages < maxPages) {
      const { data } = await axios.get(url, { timeout: 10000 });
      const arr = data?.data ?? [];
      for (const p of arr) {
        const atts = p?.attachments?.data ?? [];
        for (const a of atts) {
          const targetId = a?.target?.id;
          if (targetId && String(targetId) === String(videoId)) {
            return p.id;
          }
        }
      }
      pages++;
      url = data?.paging?.next ?? null;
    }
    return null;
  }

  // ========= SSE (live_comments) =========
  openLiveCommentsSSE(liveVideoId, onEvent, onError) {
    if (!this.token) throw new Error("FB_PAGE_ACCESS_TOKEN not set");
    const EventSource = loadEventSource();
    const fields = encodeURIComponent("from{id,name},message,created_time");
    const url = `https://streaming-graph.facebook.com/${liveVideoId}/live_comments?access_token=${this.token}&fields=${fields}&comment_rate=one_per_second`;
    const es = new EventSource(url, { withCredentials: false });
    es.onmessage = (evt) => {
      try { onEvent && onEvent(JSON.parse(evt.data)); }
      catch (e) { onError && onError(e); }
    };
    es.onerror = (err) => onError && onError(err);
    return es;
  }

  // ========= Page videos / lives =========
  async fetchPageVideos({ pageId, limit = 50, type } = {}) {
    if (!this.token) throw new Error("FB_PAGE_ACCESS_TOKEN not set");
    const base = `https://graph.facebook.com/${this.version}/${pageId}/videos`;
    const params = new URLSearchParams({
      access_token: this.token,
      fields: "id,description,created_time,permalink_url,live_status",
      limit: String(limit),
    });
    if (type === "uploaded") params.set("type", "uploaded"); // 'all' => ไม่ส่ง
    const url = `${base}?${params}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return data?.data || [];
  }

  async fetchPageLiveVideosEdge({ pageId, limit = 25 }) {
    if (!this.token) throw new Error("FB_PAGE_ACCESS_TOKEN not set");
    const base = `https://graph.facebook.com/${this.version}/${pageId}/live_videos`;
    const params = new URLSearchParams({
      access_token: this.token,
      fields: "id,status,permalink_url,creation_time",
      limit: String(limit),
    });
    const url = `${base}?${params}`;
    const { data } = await axios.get(url, { timeout: 10000 });
    return data?.data || [];
  }

  async findLiveVideoOnPage(pageId) {
    try {
      const vids = await this.fetchPageVideos({ pageId, limit: 50 });
      const live1 = vids.filter(v => (v.live_status || "").toLowerCase() === "live");
      if (live1.length) {
        live1.sort((a, b) => new Date(b.created_time) - new Date(a.created_time));
        return { id: live1[0].id, source: "videos", raw: live1[0] };
      }
    } catch (_) {}

    try {
      const lives = await this.fetchPageLiveVideosEdge({ pageId, limit: 25 });
      const live2 = lives.filter(lv => String(lv.status).toUpperCase().includes("LIVE"));
      if (live2.length) {
        live2.sort((a, b) => new Date(b.creation_time) - new Date(a.creation_time));
        return { id: live2[0].id, source: "live_videos", raw: live2[0] };
      }
    } catch (_) {}

    return null;
  }
}
