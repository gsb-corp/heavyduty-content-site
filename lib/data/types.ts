// 카테고리 데이터 타입 정의

export type Season = '봄' | '여름' | '가을' | '겨울';
export type CycleType = 'main' | 'sub';

export interface Keyword {
  name: string;
  share: number; // 검색량 비중 %
}

export interface Cycle {
  id?: string;             // Supabase uuid
  type: CycleType;
  season: Season;
  sourcing_week: string;  // "8월 1주차"
  open_week: string;       // "9월 3주차"
  peak_week: string;       // "10월 1주차"
  golden_weeks: number;    // 4
  strength_pct: number;    // 100 (메인) / 77 (서브)
  note?: string;
}

export interface Category {
  id: string;
  name: string;
  subtitle: string;
  season: Season;
  reliability: 1 | 2 | 3;  // ⭐ / ⭐⭐ / ⭐⭐⭐
  keywords: Keyword[];
  cycles: Cycle[];
  assignee_id?: string | null;
  peak_date?: string | null;   // "2026-10-07" — 시즌 카테고리만, 포시즌은 null
  track?: 'season' | 'postseason';
  lead_offset_weeks?: number;  // 정점 고정, 전체 일정을 N주 당김(+)/늦춤(-) — 기본 0
}

export interface CategoryData {
  version: string;
  verified_date: string;
  source: string;
  model: {
    sourcing_lead_weeks: number;
    open_offset_weeks: number;
    golden_weeks: number;
    peak_definition: string;
  };
  categories: Category[];
}

// 칸반 상태
export type KanbanStage =
  | '기획'
  | '촬영'
  | '편집'
  | '회원 선공개'
  | '일반 오픈'
  | '종료';

// 액션 타입 (대시보드용)
export type ActionType = 'sourcing' | 'open' | 'peak';

export interface WeekAction {
  categoryId: string;
  categoryName: string;
  cycleType: CycleType;
  cycleSeason: Season;
  actionType: ActionType;
  week: string;       // "9월 3주차"
  note?: string;
  cycleId?: string;   // cycle uuid (담당자 배정용)
}

// 담당자
export interface Assignee {
  id: string;       // 'yoonbin'
  name: string;     // '윤빈'
  color: string;
  active: boolean;
  sort_order: number;
}

// 작업 상태
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '대기',
  in_progress: '진행 중',
  done: '완료',
};

// 사이클별 액션 작업 (현재는 사용하지 않음, 테이블만 남겨둠)
export interface CycleTask {
  id: string;
  cycle_id: string;
  action_type: ActionType;
  assignee_id: string | null;
  status: TaskStatus;
  notes?: string | null;
  updated_at?: string;
}

// 진행 항목 (카테고리 단위, 자유 추가)
export interface ProgressItem {
  id: string;
  category_id: string;
  label: string;
  status: TaskStatus;
  notes?: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

// ============================================================
// 파이프라인 (운영 흐름 5단계) — 데드라인 레이더
// ============================================================

export type StageType = 'order' | 'shipping' | 'care' | 'creative' | 'publish';
export type StageTrack = 'ops' | 'content';

// 단계 정의 (정점 기준 마감 주차 offset, 트랙, 라벨)
export interface StageDef {
  type: StageType;
  label: string;          // "사입 발주"
  short: string;          // "발주"
  track: StageTrack;      // ops(운영) / content(콘텐츠)
  weeksBeforePeak: number; // 정점 기준 마감 (주)
}

// 5단계 정의 — 사용자 확정 운영 흐름
// 발주 -10주 / 배송 -6주 / 케어 -5주 / 기획·제작 -4주 / 발행 -2주
export const STAGE_DEFS: StageDef[] = [
  { type: 'order',    label: '사입 발주',      short: '발주',  track: 'ops',     weeksBeforePeak: 10 },
  { type: 'shipping', label: '배송',           short: '배송',  track: 'ops',     weeksBeforePeak: 6 },
  { type: 'care',     label: '케어·제품등록',  short: '케어',  track: 'ops',     weeksBeforePeak: 5 },
  { type: 'creative', label: '콘텐츠 기획·제작', short: '제작', track: 'content', weeksBeforePeak: 4 },
  { type: 'publish',  label: '발행 (6콘텐츠)', short: '발행',  track: 'content', weeksBeforePeak: 2 },
];

export const STAGE_DEF_MAP: Record<StageType, StageDef> = Object.fromEntries(
  STAGE_DEFS.map((s) => [s.type, s])
) as Record<StageType, StageDef>;

// 카테고리 단계 (DB 저장 — 상태·담당자)
export interface CategoryStage {
  id: string;
  category_id: string;
  stage_type: StageType;
  status: TaskStatus;
  assignee_id: string | null;
  note?: string | null;
  updated_at?: string;
}

// 트랙 라벨
export const TRACK_LABEL: Record<StageTrack, string> = {
  ops: '운영',
  content: '콘텐츠',
};

// 카테고리 트랙 (시즌/포시즌)
export type CategoryTrack = 'season' | 'postseason';
