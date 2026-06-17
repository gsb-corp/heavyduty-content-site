-- 포시즌(청바지·모자·폴로) 칸에 단계 여러 개 체크 가능하게 확장
-- 기존: (카테고리, 주) 당 발행 1개만  →  변경: (카테고리, 주, 단계) 단위로 5단계 자유 체크
-- Supabase → SQL Editor에 통째로 붙여넣고 RUN 한 번이면 됩니다.

-- 1) stage_type 컬럼 추가 (기존 체크는 모두 '발행'이었으므로 publish로 채움)
ALTER TABLE postseason_logs ADD COLUMN IF NOT EXISTS stage_type text;
UPDATE postseason_logs SET stage_type = 'publish' WHERE stage_type IS NULL;
ALTER TABLE postseason_logs ALTER COLUMN stage_type SET NOT NULL;

-- 2) 허용 값 제약 (5단계만)
ALTER TABLE postseason_logs DROP CONSTRAINT IF EXISTS postseason_logs_stage_type_check;
ALTER TABLE postseason_logs ADD CONSTRAINT postseason_logs_stage_type_check
  CHECK (stage_type IN ('order','shipping','care','creative','publish'));

-- 3) 기존 UNIQUE(category_id, week_monday) 제약 제거 (이름이 무엇이든 전부)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'postseason_logs'::regclass AND contype = 'u'
  LOOP
    EXECUTE 'ALTER TABLE postseason_logs DROP CONSTRAINT ' || quote_ident(c);
  END LOOP;
END $$;

-- 4) 새 UNIQUE: 같은 카테고리·주·단계는 한 번만 (서로 다른 단계는 같은 칸에 공존 가능)
ALTER TABLE postseason_logs ADD CONSTRAINT postseason_logs_cat_week_stage_key
  UNIQUE (category_id, week_monday, stage_type);
