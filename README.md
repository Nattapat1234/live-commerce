# Live Commerce (Facebook Live) — Stock & Reservation

ระบบจับคอมเมนต์รูปแบบ `F{รหัสสินค้า}` ระหว่างไลฟ์สด เพื่อจองสินค้า (ตามคิวและสต็อก)

## โครงสร้าง
- `frontend/` — React (แดชบอร์ดแอดมิน)
- `backend/` — Node.js (API + Worker)

## ขั้นตอนการพัฒนา
1) ตั้งค่าโครงโปรเจกต์ (คุณอยู่ที่ขั้นตอนนี้)
2) ตั้งค่า Docker (Postgres, Redis)
3) สคีมา DB และ API เบื้องต้น
4) Mock Poller (จำลองคอมเมนต์)
5) เชื่อมต่อ Facebook Graph API (ของจริง)
6) Orders/Payment
