-- 카테고리별 일정 오프셋 추가
-- 정점(peak_date)은 고정한 채, 발주~발행 전체 파이프라인을 N주 당기거나(+) 늦춤(-)
-- 발행이 비는 주를 메우려고 일부 카테고리를 조금 당길 때 사용
-- Supabase → SQL Editor에 붙여넣고 RUN

-- 1) 컬럼 추가 (기본 0 = 기준 그대로)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS lead_offset_weeks integer NOT NULL DEFAULT 0;

-- 2) 마운틴파카: 전체 일정 1주 당김 (발행 9/14 → 9/7, 정점 9/28 고정)
UPDATE categories SET lead_offset_weeks = 1 WHERE id = 'mountain-parka';
