import pkg from "pg";
const { Pool } = pkg;

export function buildPoolConfigFromEnv() {
  const urlStr = process.env.DATABASE_URL;
  if (urlStr) {
    const u = new URL(urlStr);
    return {
      user: decodeURIComponent(u.username || ""),
      password: decodeURIComponent(u.password || ""), // สำคัญ: เป็น string เสมอ
      host: u.hostname || "localhost",
      port: u.port ? Number(u.port) : 5432,
      database: (u.pathname || "").replace(/^\//, ""),
      max: 10,
      idleTimeoutMillis: 30_000,
    };
  }
  return {
    user: process.env.DB_USER || "app_user",
    password: String(process.env.DB_PASSWORD ?? ""),
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "livecommerce",
    max: 10,
    idleTimeoutMillis: 30_000,
  };
}

export class Database {
  constructor(cfg = buildPoolConfigFromEnv()) {
    this.pool = new Pool(cfg);
  }
  query(text, params) { return this.pool.query(text, params); }
  async getClient() { return this.pool.connect(); }
}
