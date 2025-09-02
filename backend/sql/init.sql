BEGIN;

-- ============= Products =============
CREATE TABLE IF NOT EXISTS products (
  id               BIGSERIAL PRIMARY KEY,
  sku              TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL,
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  stock_total      INTEGER NOT NULL CHECK (stock_total >= 0),
  stock_available  INTEGER NOT NULL CHECK (stock_available >= 0),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- trigger อัปเดต updated_at
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS t_products_updated ON products;
CREATE TRIGGER t_products_updated
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ============= Live Sessions =============
CREATE TABLE IF NOT EXISTS live_sessions (
  id                   BIGSERIAL PRIMARY KEY,
  page_id              TEXT NOT NULL,
  video_id             TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'live',
  last_comment_cursor  TEXT,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_video
  ON live_sessions(video_id);

-- ============= Reservations =============
CREATE TABLE IF NOT EXISTS reservations (
  id                 BIGSERIAL PRIMARY KEY,
  live_session_id    BIGINT NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  product_id         BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_fb_id         TEXT,
  user_name          TEXT,
  comment_id         TEXT NOT NULL UNIQUE,
  position_in_queue  INTEGER NOT NULL CHECK (position_in_queue > 0),
  status             TEXT NOT NULL DEFAULT 'reserved',
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resv_live_product
  ON reservations(live_session_id, product_id, position_in_queue);

CREATE INDEX IF NOT EXISTS idx_resv_status_expiry
  ON reservations(status, expires_at);

-- (ตัวอย่าง seed; ลบได้ถ้าไม่ต้องการ)
INSERT INTO products (sku, name, price_cents, stock_total, stock_available, is_active)
VALUES
  ('sk01', 'Item 1', 12000, 10, 10, TRUE),
  ('sk02', 'Item 2', 15000,  5,  5, TRUE)
ON CONFLICT (sku) DO NOTHING;

COMMIT;
