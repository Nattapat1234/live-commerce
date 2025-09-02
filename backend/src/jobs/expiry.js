import cron from "node-cron";

export function startExpiryJob(reservationService) {
  cron.schedule("* * * * *", async () => {
    try {
      const n = await reservationService.expireAndRestore();
      if (n > 0) console.log(`[expiry] expired & restored: ${n}`);
    } catch (e) {
      console.error("[expiry] error:", e?.message || e);
    }
  });
}
