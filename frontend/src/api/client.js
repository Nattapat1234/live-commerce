export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function http(method, path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch { /* ignore JSON parse errors */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// ===== Admin: confirm / cancel reservation =====
async function adminConfirmReservation(id) {
  return http("POST", `/admin/reservations/${id}/confirm`);
}
async function adminCancelReservation(id, body = {}) {
  return http("POST", `/admin/reservations/${id}/cancel`, body);
}
// ประวัติการจองของ live session
async function getReservations(liveSessionId, { status = "all", limit = 200, q = "" } = {}) {
  const params = new URLSearchParams({ status, limit: String(limit) });
  if (q) params.set("q", q);
  const res = await http.get(`/live-sessions/${liveSessionId}/reservations?${params.toString()}`);
  return res.data;
}


export const api = {
  // infra
  health: () => http("GET", "/health"),
  // live sessions
  createLive: (page_id, video_id) => http("POST", "/live-sessions", { page_id, video_id }),
  startPoller: (id) => http("POST", `/live-sessions/${id}/start`),
  stopPoller: (id) => http("POST", `/live-sessions/${id}/stop`),
  getQueue: (id) => http("GET", `/live-sessions/${id}/queue`),
  // fb helper
  fbVideos: (pageId, type = "all") => http("GET", `/fb/videos?page_id=${encodeURIComponent(pageId)}&type=${type}`),
  fbLiveCurrent: (pageId) => http("GET", `/fb/live-current?page_id=${encodeURIComponent(pageId)}`),
  fbAutoStart: (pageId) => http("POST", "/fb/auto-start", { page_id: pageId }),

  // product
  getProducts: () => http("GET", "/products"),
  createProduct: (p) => http("POST", "/products", p),
  updateProduct: (id, body) => http("PATCH", `/products/${id}`, body),
  restockProduct: (id, amount) => http("PATCH", `/products/${id}`, { restock: amount }),
  deleteProduct: (id) => http("DELETE", `/products/${id}`),

  adminConfirmReservation,
  adminCancelReservation,

  getReservations,

  getHistory(liveSessionId, { status = "all", q = "", limit = 50 } = {}) {
    const u = new URL(`${API_URL}/live-sessions/${liveSessionId}/history`);
    if (status) u.searchParams.set("status", status);
    if (q) u.searchParams.set("q", q);
    u.searchParams.set("limit", String(limit));
    return http("GET", u.pathname + u.search);
  },
}
