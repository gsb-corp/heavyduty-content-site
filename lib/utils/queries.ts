// Supabase 쿼리 헬퍼

import { supabase } from '@/lib/supabase';
import type { Category, Cycle, Assignee, CycleTask, TaskStatus, ActionType, ProgressItem, CategoryStage, StageType } from '@/lib/data/types';

/**
 * 모든 활성 카테고리 fetch (정점 날짜·트랙 포함)
 */
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, subtitle, season, reliability, keywords, assignee_id, peak_date, track')
    .eq('active', true)
    .order('sort_order');

  if (error) {
    console.error('fetchCategories error:', error);
    throw error;
  }

  return (data || []).map((c) => ({ ...c, cycles: [] })) as unknown as Category[];
}

/**
 * 단일 카테고리 + 사이클 + 메모 + 체크리스트 + 칸반 상태
 */
export async function fetchCategoryDetail(id: string) {
  const { data: category, error: catErr } = await supabase
    .from('categories')
    .select('*, cycles(*)')
    .eq('id', id)
    .single();
  if (catErr) throw catErr;

  const { data: notes } = await supabase
    .from('content_notes')
    .select('*')
    .eq('category_id', id)
    .order('created_at', { ascending: false });

  const { data: checklists } = await supabase
    .from('checklists')
    .select('*')
    .eq('category_id', id)
    .order('sort_order');

  const { data: kanban } = await supabase
    .from('kanban_status')
    .select('*')
    .eq('category_id', id)
    .order('updated_at', { ascending: false });

  return {
    category,
    notes: notes || [],
    checklists: checklists || [],
    kanban: kanban || [],
  };
}

/**
 * 카테고리 추가 또는 수정
 */
export async function upsertCategory(cat: Partial<Category> & { id: string }) {
  const { error } = await supabase.from('categories').upsert({
    id: cat.id,
    name: cat.name,
    subtitle: cat.subtitle,
    season: cat.season,
    reliability: cat.reliability,
    keywords: cat.keywords,
  });
  if (error) throw error;
}

/**
 * 카테고리 삭제 (cascade로 cycles·notes 등 모두 삭제)
 */
export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 사이클 수정
 */
export async function upsertCycle(
  categoryId: string,
  cycle: Partial<Cycle> & { id?: string }
) {
  const payload = {
    category_id: categoryId,
    type: cycle.type,
    season: cycle.season,
    sourcing_week: cycle.sourcing_week,
    open_week: cycle.open_week,
    peak_week: cycle.peak_week,
    golden_weeks: cycle.golden_weeks ?? 4,
    strength_pct: cycle.strength_pct ?? 100,
    note: cycle.note ?? null,
  };
  const { error } = cycle.id
    ? await supabase.from('cycles').update(payload).eq('id', cycle.id)
    : await supabase.from('cycles').insert(payload);
  if (error) throw error;
}

/**
 * 사이클 삭제
 */
export async function deleteCycle(cycleId: string) {
  const { error } = await supabase.from('cycles').delete().eq('id', cycleId);
  if (error) throw error;
}

/**
 * 메모 추가
 */
export async function addNote(categoryId: string, body: string, author?: string) {
  const { error } = await supabase.from('content_notes').insert({
    category_id: categoryId,
    body,
    author: author || null,
  });
  if (error) throw error;
}

/**
 * 메모 삭제
 */
export async function deleteNote(noteId: string) {
  const { error } = await supabase.from('content_notes').delete().eq('id', noteId);
  if (error) throw error;
}

// ============================================================
// 담당자 & 작업 (Assignees & Cycle Tasks)
// ============================================================

export async function fetchAssignees(): Promise<Assignee[]> {
  const { data, error } = await supabase
    .from('assignees')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return (data || []) as Assignee[];
}

export async function fetchAllCycleTasks(): Promise<CycleTask[]> {
  const { data, error } = await supabase.from('cycle_tasks').select('*');
  if (error) throw error;
  return (data || []) as CycleTask[];
}

export async function fetchCycleTasksForCycle(cycleId: string): Promise<CycleTask[]> {
  const { data, error } = await supabase
    .from('cycle_tasks')
    .select('*')
    .eq('cycle_id', cycleId);
  if (error) throw error;
  return (data || []) as CycleTask[];
}

/**
 * cycle + action_type 단위로 담당자/상태 upsert
 * (UNIQUE(cycle_id, action_type) 제약으로 한 행만 유지)
 */
export async function upsertCycleTask(
  cycleId: string,
  actionType: ActionType,
  patch: { assignee_id?: string | null; status?: TaskStatus; notes?: string | null }
) {
  const { data: existing } = await supabase
    .from('cycle_tasks')
    .select('id')
    .eq('cycle_id', cycleId)
    .eq('action_type', actionType)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('cycle_tasks')
      .update(patch)
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('cycle_tasks').insert({
      cycle_id: cycleId,
      action_type: actionType,
      assignee_id: patch.assignee_id ?? null,
      status: patch.status ?? 'todo',
      notes: patch.notes ?? null,
    });
    if (error) throw error;
  }
}

export async function addAssignee(id: string, name: string) {
  const { error } = await supabase.from('assignees').insert({
    id,
    name,
    color: '#000000',
    sort_order: 999,
  });
  if (error) throw error;
}

export async function deleteAssignee(id: string) {
  const { error } = await supabase.from('assignees').delete().eq('id', id);
  if (error) throw error;
}

/**
 * 카테고리 담당자 변경
 */
export async function setCategoryAssignee(categoryId: string, assigneeId: string | null) {
  const { error } = await supabase
    .from('categories')
    .update({ assignee_id: assigneeId })
    .eq('id', categoryId);
  if (error) throw error;
}

// ============================================================
// 진행 항목 (Progress Items)
// ============================================================

export async function fetchProgressItems(categoryId: string): Promise<ProgressItem[]> {
  const { data, error } = await supabase
    .from('progress_items')
    .select('*')
    .eq('category_id', categoryId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return (data || []) as ProgressItem[];
}

export async function fetchAllProgressItems(): Promise<ProgressItem[]> {
  const { data, error } = await supabase
    .from('progress_items')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return (data || []) as ProgressItem[];
}

export async function addProgressItem(categoryId: string, label: string) {
  const { error } = await supabase.from('progress_items').insert({
    category_id: categoryId,
    label,
    status: 'todo',
    sort_order: 999,
  });
  if (error) throw error;
}

export async function updateProgressItem(
  id: string,
  patch: { label?: string; status?: TaskStatus; notes?: string | null }
) {
  const { error } = await supabase.from('progress_items').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteProgressItem(id: string) {
  const { error } = await supabase.from('progress_items').delete().eq('id', id);
  if (error) throw error;
}

// ============================================================
// 파이프라인 단계 (Category Stages) — 데드라인 레이더
// ============================================================

export async function fetchAllCategoryStages(): Promise<CategoryStage[]> {
  const { data, error } = await supabase.from('category_stages').select('*');
  if (error) throw error;
  return (data || []) as CategoryStage[];
}

export async function fetchCategoryStages(categoryId: string): Promise<CategoryStage[]> {
  const { data, error } = await supabase
    .from('category_stages')
    .select('*')
    .eq('category_id', categoryId);
  if (error) throw error;
  return (data || []) as CategoryStage[];
}

/** 단계 상태/담당자 변경 (category_id + stage_type 단위 upsert) */
export async function updateCategoryStage(
  categoryId: string,
  stageType: StageType,
  patch: { status?: TaskStatus; assignee_id?: string | null; note?: string | null }
) {
  const { data: existing } = await supabase
    .from('category_stages')
    .select('id')
    .eq('category_id', categoryId)
    .eq('stage_type', stageType)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('category_stages').update(patch).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('category_stages').insert({
      category_id: categoryId,
      stage_type: stageType,
      status: patch.status ?? 'todo',
      assignee_id: patch.assignee_id ?? null,
      note: patch.note ?? null,
    });
    if (error) throw error;
  }
}

/** 카테고리 정점 날짜 수정 */
export async function setCategoryPeakDate(categoryId: string, peakDate: string | null) {
  const { error } = await supabase
    .from('categories')
    .update({ peak_date: peakDate })
    .eq('id', categoryId);
  if (error) throw error;
}

// ============================================================
// 포시즌 발행 기록 (Postseason Logs) — 주차별 발행 체크
// ============================================================

export interface PostseasonLog {
  id: string;
  category_id: string;
  week_monday: string; // "2026-08-17"
  stage_type: StageType; // 발주/배송/케어/제작/발행
  note?: string | null;
}

export async function fetchPostseasonLogs(): Promise<PostseasonLog[]> {
  const { data, error } = await supabase.from('postseason_logs').select('*');
  if (error) throw error;
  return (data || []) as PostseasonLog[];
}

/** 포시즌 단계 체크 토글 — (카테고리·주·단계) 있으면 삭제, 없으면 추가 */
export async function togglePostseasonLog(categoryId: string, weekMonday: string, stageType: StageType) {
  const { data: existing } = await supabase
    .from('postseason_logs')
    .select('id')
    .eq('category_id', categoryId)
    .eq('week_monday', weekMonday)
    .eq('stage_type', stageType)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from('postseason_logs').delete().eq('id', existing.id);
    if (error) throw error;
    return false; // 해제됨
  } else {
    const { error } = await supabase.from('postseason_logs').insert({ category_id: categoryId, week_monday: weekMonday, stage_type: stageType });
    if (error) throw error;
    return true; // 체크됨
  }
}

// ============================================================
// 발행 6콘텐츠 담당자/완료 (Content Tasks)
// ============================================================

export interface ContentTask {
  id: string;
  category_id: string;
  content_day: string; // '월'..'일'
  assignee_id: string | null;
  done: boolean;
}

export async function fetchContentTasks(categoryId: string): Promise<ContentTask[]> {
  const { data, error } = await supabase
    .from('content_tasks')
    .select('*')
    .eq('category_id', categoryId);
  if (error) throw error;
  return (data || []) as ContentTask[];
}

/** 콘텐츠(요일) 단위 담당자/완료 upsert */
export async function updateContentTask(
  categoryId: string,
  contentDay: string,
  patch: { assignee_id?: string | null; done?: boolean }
) {
  const { data: existing } = await supabase
    .from('content_tasks')
    .select('id')
    .eq('category_id', categoryId)
    .eq('content_day', contentDay)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from('content_tasks').update(patch).eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('content_tasks').insert({
      category_id: categoryId,
      content_day: contentDay,
      assignee_id: patch.assignee_id ?? null,
      done: patch.done ?? false,
    });
    if (error) throw error;
  }
}
