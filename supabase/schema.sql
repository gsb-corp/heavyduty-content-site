-- ============================================================
-- 헤비듀티 콘텐츠 사이트 DB 스키마
-- Supabase SQL Editor에서 통째로 실행
-- ============================================================

-- 1. categories — 15개 카테고리 마스터
CREATE TABLE IF NOT EXISTS categories (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  subtitle        text,
  season          text CHECK (season IN ('봄','여름','가을','겨울')),
  reliability     int  CHECK (reliability BETWEEN 1 AND 3),
  keywords        jsonb,
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  note            text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- 2. cycles — 카테고리당 1~2개의 사이클 (메인/서브)
CREATE TABLE IF NOT EXISTS cycles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     text REFERENCES categories(id) ON DELETE CASCADE,
  type            text CHECK (type IN ('main','sub')) NOT NULL,
  season          text CHECK (season IN ('봄','여름','가을','겨울')) NOT NULL,
  sourcing_week   text NOT NULL,   -- "8월 1주차"
  open_week       text NOT NULL,
  peak_week       text NOT NULL,
  golden_weeks    int  DEFAULT 4,
  strength_pct    int  DEFAULT 100,
  note            text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cycles_category ON cycles(category_id);

-- 3. content_notes — 카테고리별 콘텐츠 앵글 메모
CREATE TABLE IF NOT EXISTS content_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     text REFERENCES categories(id) ON DELETE CASCADE,
  cycle_id        uuid REFERENCES cycles(id) ON DELETE SET NULL,
  body            text NOT NULL,
  author          text,           -- 작성자 이메일 또는 이름
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_category ON content_notes(category_id);

-- 4. checklists — 카테고리별 체크리스트 (사진·영상·캡션 등)
CREATE TABLE IF NOT EXISTS checklists (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     text REFERENCES categories(id) ON DELETE CASCADE,
  cycle_id        uuid REFERENCES cycles(id) ON DELETE CASCADE,
  label           text NOT NULL,  -- "촬영 완료", "캡션 작성" 등
  checked         boolean DEFAULT false,
  checked_by      text,
  checked_at      timestamptz,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklists_category ON checklists(category_id);

-- 5. kanban_status — 콘텐츠 진행 칸반 단계
CREATE TABLE IF NOT EXISTS kanban_status (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     text REFERENCES categories(id) ON DELETE CASCADE,
  cycle_id        uuid REFERENCES cycles(id) ON DELETE CASCADE,
  stage           text CHECK (stage IN ('기획','촬영','편집','선공개','오픈','종료')) NOT NULL,
  updated_at      timestamptz DEFAULT now(),
  updated_by      text
);

CREATE INDEX IF NOT EXISTS idx_kanban_category ON kanban_status(category_id);

-- 6a. assignees — 담당자 마스터 (윤빈/혁찬/지훈 등)
CREATE TABLE IF NOT EXISTS assignees (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  color           text NOT NULL DEFAULT '#000000',
  active          boolean DEFAULT true,
  sort_order      int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- 6b. cycle_tasks — 사이클의 각 액션(사입/오픈/피크)별 담당자·상태
CREATE TABLE IF NOT EXISTS cycle_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        uuid REFERENCES cycles(id) ON DELETE CASCADE,
  action_type     text CHECK (action_type IN ('sourcing','open','peak')) NOT NULL,
  assignee_id     text REFERENCES assignees(id) ON DELETE SET NULL,
  status          text CHECK (status IN ('todo','in_progress','done')) NOT NULL DEFAULT 'todo',
  notes           text,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(cycle_id, action_type)
);

CREATE INDEX IF NOT EXISTS idx_cycle_tasks_cycle ON cycle_tasks(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_tasks_assignee ON cycle_tasks(assignee_id);

-- 7. audit_log — 변경 이력 (옵션)
CREATE TABLE IF NOT EXISTS audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email      text,
  action          text,           -- "create"/"update"/"delete"
  table_name      text,
  record_id       text,
  before          jsonb,
  after           jsonb,
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- updated_at 자동 갱신 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categories_updated ON categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cycles_updated ON cycles;
CREATE TRIGGER trg_cycles_updated BEFORE UPDATE ON cycles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notes_updated ON content_notes;
CREATE TRIGGER trg_notes_updated BEFORE UPDATE ON content_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cycle_tasks_updated ON cycle_tasks;
CREATE TRIGGER trg_cycle_tasks_updated BEFORE UPDATE ON cycle_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS (Row Level Security) - 일단 모두 허용 (개발 단계)
-- 추후 팀원 인증 붙이면 정책 추가
-- ============================================================
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_status   ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cycle_tasks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;

-- 일단은 anon(publishable) 키로 모든 작업 가능 (개발용)
-- 운영 시 정책 강화 필요
CREATE POLICY "anon_all_categories"    ON categories    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cycles"        ON cycles        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_notes"         ON content_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_checklists"    ON checklists    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_kanban"        ON kanban_status FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_assignees"     ON assignees     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cycle_tasks"   ON cycle_tasks   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_audit"         ON audit_log     FOR ALL USING (true) WITH CHECK (true);

-- 초기 담당자 3명 (윤빈/혁찬/지훈)
INSERT INTO assignees (id, name, color, sort_order) VALUES
  ('yoonbin',  '윤빈', '#000000', 0),
  ('hyukchan', '혁찬', '#000000', 1),
  ('jihoon',   '지훈', '#000000', 2)
ON CONFLICT (id) DO NOTHING;
