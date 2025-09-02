import Redis from "ioredis";

export class RedisClient {
  constructor(url, opts = {}) {
    this.client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: true,
      ...opts,
    });
    this.client.on("error", (err) =>
      console.error("[redis] error:", err?.message || err)
    );
  }
  ping() { return this.client.ping(); }
  get(...a) { return this.client.get(...a); }
  set(...a) { return this.client.set(...a); }
  del(...a) { return this.client.del(...a); }
}
