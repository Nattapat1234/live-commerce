import "dotenv/config";
import express from "express";
import cors from "cors";
import { makeFbRouter } from "./routes/fb.js";
import { LiveSessionService } from "./services/liveSessions.js";
import { Database } from "./db.js";
import { RedisClient } from "./redis.js";
import { LockManager } from "./utils/lock.js";
import { ProductService, InventoryService } from "./services/inventory.js";
import { ReservationService } from "./services/reservations.js";
import { FBClient } from "./facebook/client.js";
import { PollerService } from "./facebook/poller.js";
import { startExpiryJob } from "./jobs/expiry.js";
import { makeProductsRouter } from "./routes/products.js";
import { makeLiveRouter } from "./routes/live.js";
import { makeAdminRouter } from "./routes/admin.js";



// --- สร้าง instance หลัง dotenv โหลดแล้ว ---
const db = new Database();
const redis = new RedisClient(process.env.REDIS_URL);
const lockManager = new LockManager(redis.client);
const productService = new ProductService(db);
const inventoryService = new InventoryService(db);
const reservationService = new ReservationService(db, lockManager, inventoryService);



const fbClient = new FBClient({
  version: process.env.FB_GRAPH_VERSION || "v23.0",
  token: process.env.FB_PAGE_ACCESS_TOKEN,
});
const pollerService = new PollerService({
  db, fbClient, reservationService,
  useSSE: String(process.env.FB_USE_SSE || "false").toLowerCase() === "true",
});


const liveSessionService = new LiveSessionService({ db, fbClient, pollerService }); // NEW

const app = express();

app.locals.db = db;


app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) =>
  res.json({ ok: true, service: "backend", time: new Date().toISOString() })
);
app.get("/db/ping", async (_req, res) => {
  try { const r = await db.query("SELECT now() AS now"); res.json({ ok: true, now: r.rows[0].now }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});
app.get("/redis/ping", async (_req, res) => {
  try { const pong = await redis.ping(); res.json({ ok: true, redis: pong }); }
  catch (e) { res.status(500).json({ ok: false, error: String(e) }); }
});

app.use("/products", makeProductsRouter({ productService }));
app.use("/", makeLiveRouter({ db, pollerService }));

// >>> เพิ่มอันนี้ <<<
app.use("/fb", makeFbRouter({ fbClient, liveSessionService })); // NEW

app.use("/admin", makeAdminRouter({ reservationService }));


app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(500).json({ error: "Internal Server Error", detail: String(err?.message || err) });
});

startExpiryJob(reservationService);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`backend running on http://localhost:${PORT}`));
