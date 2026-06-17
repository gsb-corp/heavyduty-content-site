// 파이프라인 — 정점 날짜에서 단계별 데드라인 자동 계산 + 긴급도 분류

import type {
  Category,
  CategoryStage,
  StageDef,
  StageType,
  TaskStatus,
} from '@/lib/data/types';
import { STAGE_DEFS, STAGE_DEF_MAP } from '@/lib/data/types';

// 긴급도 — 데드라인까지 남은 기간 기준
export type Urgency = 'overdue' | 'thisweek' | 'soon' | 'later' | 'done';

export const URGENCY_LABEL: Record<Urgency, string> = {
  overdue: '지난 데드라인',
  thisweek: '이번 주 마감',
  soon: '다가오는 2주',
  later: '여유',
  done: '완료',
};

// 한 단계의 계산된 정보 (데드라인 + 긴급도 + 상태 + 담당)
export interface StageView {
  categoryId: string;
  categoryName: string;
  stageType: StageType;
  def: StageDef;
  deadline: Date;        // 마감일
  status: TaskStatus;
  assigneeId: string | null;
  urgency: Urgency;
  daysLeft: number;      // 오늘 기준 남은 일수 (음수면 지남)
}

/** 정점 날짜 - N주 = 단계 마감일 */
export function stageDeadline(peakDate: Date, weeksBeforePeak: number): Date {
  const d = new Date(peakDate);
  d.setDate(d.getDate() - weeksBeforePeak * 7);
  return d;
}

/** 두 날짜 사이 일수 차이 (b - a, 일 단위) */
function dayDiff(a: Date, b: Date): number {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/** 긴급도 판정 — 완료면 done, 아니면 데드라인까지 남은 일수로 분류 */
export function classifyUrgency(deadline: Date, today: Date, status: TaskStatus): Urgency {
  if (status === 'done') return 'done';
  const left = dayDiff(today, deadline);
  if (left < 0) return 'overdue';      // 마감 지남
  if (left <= 7) return 'thisweek';    // 이번 주
  if (left <= 21) return 'soon';       // 2~3주 내
  return 'later';
}

/**
 * 카테고리 + 단계 데이터 → 계산된 StageView 배열
 * 포시즌(정점 없음)은 빈 배열 반환
 */
export function buildStageViews(
  category: Category,
  stages: CategoryStage[],
  today: Date
): StageView[] {
  if (!category.peak_date) return [];
  const peak = new Date(category.peak_date);
  const offset = category.lead_offset_weeks ?? 0; // 정점 고정, 전체 N주 당김(+)/늦춤(-)
  const stageByType = Object.fromEntries(stages.map((s) => [s.stage_type, s]));

  return STAGE_DEFS.map((def) => {
    const saved = stageByType[def.type];
    const status: TaskStatus = saved?.status || 'todo';
    const deadline = stageDeadline(peak, def.weeksBeforePeak + offset);
    return {
      categoryId: category.id,
      categoryName: category.name,
      stageType: def.type,
      def,
      deadline,
      status,
      assigneeId: saved?.assignee_id ?? null,
      urgency: classifyUrgency(deadline, today, status),
      daysLeft: dayDiff(today, deadline),
    };
  });
}

/** 전체 카테고리의 모든 단계를 평탄화 — 대시보드 레이더용 */
export function buildAllStageViews(
  categories: Category[],
  allStages: CategoryStage[],
  today: Date
): StageView[] {
  const byCat: Record<string, CategoryStage[]> = {};
  for (const s of allStages) {
    (byCat[s.category_id] ||= []).push(s);
  }
  const views: StageView[] = [];
  for (const cat of categories) {
    views.push(...buildStageViews(cat, byCat[cat.id] || [], today));
  }
  return views;
}

/** 긴급도별 그룹화 (overdue → thisweek → soon → later → done) */
export function groupByUrgency(views: StageView[]) {
  return {
    overdue: views.filter((v) => v.urgency === 'overdue').sort((a, b) => a.daysLeft - b.daysLeft),
    thisweek: views.filter((v) => v.urgency === 'thisweek').sort((a, b) => a.daysLeft - b.daysLeft),
    soon: views.filter((v) => v.urgency === 'soon').sort((a, b) => a.daysLeft - b.daysLeft),
    later: views.filter((v) => v.urgency === 'later').sort((a, b) => a.daysLeft - b.daysLeft),
    done: views.filter((v) => v.urgency === 'done'),
  };
}

/** 날짜 → "M/D (월 N주차)" 라벨 */
export function formatDeadline(d: Date): string {
  const day = d.getDate();
  const w = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
  return `${d.getMonth() + 1}/${day} (${d.getMonth() + 1}월 ${w}주차)`;
}

/** 남은 일수 → 사람이 읽는 라벨 */
export function daysLeftLabel(daysLeft: number): string {
  if (daysLeft < 0) return `${Math.abs(daysLeft)}일 지남`;
  if (daysLeft === 0) return '오늘 마감';
  if (daysLeft === 1) return '내일 마감';
  return `${daysLeft}일 남음`;
}

// ============================================================
// 주차 그리드 — 캘린더 시간표용
// ============================================================

/** 해당 날짜가 속한 주의 월요일 */
export function weekMonday(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = r.getDay(); // 0=일, 1=월
  const diff = dow === 0 ? -6 : 1 - dow; // 월요일로
  r.setDate(r.getDate() + diff);
  return r;
}

/** start~end 사이 월요일 배열 */
export function weeksBetween(start: Date, end: Date): Date[] {
  const weeks: Date[] = [];
  const cur = weekMonday(start);
  const last = weekMonday(end);
  while (cur <= last) {
    weeks.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
  }
  return weeks;
}

/** 날짜가 weeks 배열에서 몇 번째 주인지 (없으면 -1) */
export function weekIndexOf(weeks: Date[], d: Date): number {
  const m = weekMonday(d);
  return weeks.findIndex((w) => w.getTime() === m.getTime());
}

/** 월요일 → "M/D" */
export function mondayLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 날짜 → 그 달의 N주차 (1-7=1, 8-14=2, 15-21=3, 22~=4) */
export function weekOfMonth(d: Date): number {
  const day = d.getDate();
  return day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4;
}

/** 주차 컬럼 → "N주차" (주의 목요일 기준 월 판정, 월 넘어가는 주 처리) */
export function weekColLabel(monday: Date): { month: number; week: number } {
  // 주의 대표일을 목요일로 잡아 월 결정 (ISO 관습)
  const thu = new Date(monday);
  thu.setDate(thu.getDate() + 3);
  return { month: thu.getMonth() + 1, week: weekOfMonth(thu) };
}

/** 월별 그룹 — 연속된 같은 월 컬럼을 묶음 (colspan용) */
export interface MonthGroup {
  month: number;
  startIdx: number;
  count: number;
}
export function groupWeeksByMonth(weeks: Date[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  weeks.forEach((w, i) => {
    const { month } = weekColLabel(w);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.count++;
    else groups.push({ month, startIdx: i, count: 1 });
  });
  return groups;
}

/** 발행 주차의 6콘텐츠 — 정점 -2주의 월~일 */
export interface ContentItem {
  day: string;      // 월/화/...
  type: string;     // 제품 업데이트 등
  date: Date;
  isCulture?: boolean;
}

const CONTENT_PATTERN: { day: string; offset: number; type: string; culture?: boolean }[] = [
  { day: '월', offset: 0, type: '제품 업데이트' },
  { day: '화', offset: 1, type: '제품 콘텐츠' },
  { day: '수', offset: 2, type: '정보성 콘텐츠' },
  { day: '목', offset: 3, type: '문화 콘텐츠', culture: true },
  { day: '금', offset: 4, type: 'OOTD 카드뉴스' },
  { day: '일', offset: 6, type: 'OOTD 릴스' },
];

/** 정점 날짜 → 발행 주차(정점 -2주, 오프셋 반영)의 6콘텐츠 (월~일) */
export function publishContents(peakDate: Date, offsetWeeks = 0): ContentItem[] {
  const publishMonday = weekMonday(stageDeadline(peakDate, 2 + offsetWeeks));
  return CONTENT_PATTERN.map((c) => {
    const date = new Date(publishMonday);
    date.setDate(date.getDate() + c.offset);
    return { day: c.day, type: c.type, date, isCulture: c.culture };
  });
}
