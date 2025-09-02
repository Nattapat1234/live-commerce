export class LockManager {
  constructor(redisLike) {
    this.redis = redisLike; // ต้องมี get/set/del
  }

  async withLock(key, ttlMs, fn) {
    const token = `${Date.now()}-${Math.random()}`;
    // NX + PX → ได้ล็อกเฉพาะคนแรก
    const ok = await this.redis.set(key, token, "PX", ttlMs, "NX");
    if (!ok) return false;
    try {
      await fn();
      return true;
    } finally {
      const v = await this.redis.get(key);
      if (v === token) await this.redis.del(key);
    }
  }
}
