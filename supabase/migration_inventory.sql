-- 재고·원가 모듈 — 사입 배치 + 아이템 마스터 (1행 = 1아이템)
-- Supabase → SQL Editor에 통째로 붙여넣고 RUN

-- 사입 배치 (이베이 선적 단위 / 벌크 랏 파일 단위)
CREATE TABLE IF NOT EXISTS hd_batches (
  id text PRIMARY KEY,                 -- 'EBAY선적1', 'LOT:JIPATA 1번 - ...'
  label text NOT NULL,
  source text NOT NULL CHECK (source IN ('ebay','lot','manual')),
  cost_product numeric,                -- 제품 사입가
  cost_vat numeric,                    -- 부가세
  cost_duty numeric,                   -- 관세
  cost_ship_intl numeric,              -- 해외배송비
  cost_ship_dom numeric,               -- 국내배송비
  cost_etc numeric,                    -- 기타(통관수수료 등)
  cost_total numeric,                  -- 제품 총 금액
  qty_declared numeric,                -- 시트상 총 수량
  qty_loss numeric,                    -- 로스 수량
  note text,
  created_at timestamptz DEFAULT now()
);

-- 아이템 마스터
CREATE TABLE IF NOT EXISTS hd_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,           -- 품번 (정규화: 대문자)
  batch_id text REFERENCES hd_batches(id) ON DELETE SET NULL,
  name_en text,                        -- 사입 제품명
  name_kr text,                        -- 업로드 제품명
  usd numeric,                         -- 개별 사입가(USD)
  unit_cost integer,                   -- 개별 원가(원) — 배치 비용 자동배분
  cost_alloc text,                     -- 배분 방식: usd_ratio / equal_split / median_est
  list_price integer,                  -- 책정가
  sold_price integer,                  -- 실판매가
  status text NOT NULL DEFAULT 'listed'
    CHECK (status IN ('ordered','shipping','arrived','care','listed','sold','loss')),
  arrived_date date,
  sold_date date,
  order_no text,                       -- 이베이 오더넘버
  source text,                         -- ebay / lot / sales_only / manual
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS hd_items_status_idx ON hd_items(status);
CREATE INDEX IF NOT EXISTS hd_items_batch_idx  ON hd_items(batch_id);

-- RLS — 기존 테이블과 동일 (개발 단계 전체 허용, 추후 강화)
ALTER TABLE hd_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE hd_items   ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_all_hd_batches" ON hd_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_hd_items"   ON hd_items   FOR ALL USING (true) WITH CHECK (true);
