'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Category, Assignee, CategoryStage, TaskStatus, StageType } from '@/lib/data/types';
import { TRACK_LABEL, STAGE_DEFS } from '@/lib/data/types';
import { fetchCategories, fetchAssignees, fetchAllCategoryStages, updateCategoryStage, fetchPostseasonLogs, togglePostseasonLog, fetchContentTasks, updateContentTask, type PostseasonLog, type ContentTask } from '@/lib/utils/queries';
import {
  buildAllStageViews,
  buildStageViews,
  groupByUrgency,
  formatDeadline,
  daysLeftLabel,
  URGENCY_LABEL,
  weeksBetween,
  weekIndexOf,
  weekMonday,
  mondayLabel,
  weekColLabel,
  groupWeeksByMonth,
  publishContents,
  type StageView,
  type Urgency,
} from '@/lib/utils/pipeline';

const CARD_BORDER = '2px solid #A3A3A3';
const STRONG_BORDER = '2px solid #000';

const STAGE_ICON: Record<StageType, string> = {
  order: '📦', shipping: '🚚', care: '🏷️', creative: '✏️', publish: '📣',
};

// 카테고리별 식별 색 (행 좌측 바 + 라벨 배경) — 채도 낮은 톤
const CAT_COLORS = [
  '#E8554E', '#E58E26', '#D4A017', '#3D8B40', '#2E8B8B',
  '#3672C0', '#6A5ACD', '#B5497E', '#8B6B4A', '#5A8F3C',
  '#C0556B', '#4A7A9B',
];
function catColor(idx: number) { return CAT_COLORS[idx % CAT_COLORS.length]; }
const STAGE_SHORT: Record<StageType, string> = {
  order: '발주', shipping: '배송', care: '케어', creative: '제작', publish: '발행',
};

// 긴급도별 색
const URGENCY_STYLE: Record<Urgency, { bg: string; fg: string; border: string; mark: string }> = {
  overdue:  { bg: '#000000', fg: '#FFFFFF', border: '#000000', mark: '🔴' },
  thisweek: { bg: '#FFD6D6', fg: '#000000', border: '#C0392B', mark: '🟠' },
  soon:     { bg: '#FFF4E0', fg: '#000000', border: '#D4A017', mark: '🟡' },
  later:    { bg: '#FFFFFF', fg: '#404040', border: '#D4D4D4', mark: '⚪' },
  done:     { bg: '#EDEDED', fg: '#999999', border: '#D4D4D4', mark: '✅' },
};

function formatDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
function dateToInputValue(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const [today, setToday] = useState<Date | null>(null);
  const [simDate, setSimDate] = useState<Date | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [stages, setStages] = useState<CategoryStage[]>([]);
  const [postLogs, setPostLogs] = useState<PostseasonLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'radar'>('grid');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [contentTasks, setContentTasks] = useState<ContentTask[]>([]);
  // 포시즌 칸 클릭 시 뜨는 단계 선택 팝업 (어느 칸인지 + 화면 좌표)
  const [postPicker, setPostPicker] = useState<{ catId: string; iso: string; x: number; y: number } | null>(null);

  // 카테고리 펼칠 때 그 카테고리의 콘텐츠 작업 로드
  async function openCategory(id: string | null) {
    setExpanded(id);
    if (id) {
      try { setContentTasks(await fetchContentTasks(id)); } catch { setContentTasks([]); }
    } else {
      setContentTasks([]);
    }
  }

  async function changeContentTask(categoryId: string, day: string, patch: { assignee_id?: string | null; done?: boolean }) {
    setContentTasks((prev) => {
      const idx = prev.findIndex((t) => t.category_id === categoryId && t.content_day === day);
      if (idx >= 0) { const c = [...prev]; c[idx] = { ...c[idx], ...patch }; return c; }
      return [...prev, { id: 'tmp', category_id: categoryId, content_day: day, assignee_id: null, done: false, ...patch }];
    });
    try { await updateContentTask(categoryId, day, patch); }
    catch (e: any) { alert('저장 실패: ' + e.message); }
  }

  async function loadAll() {
    try {
      const [cats, ass, stg, logs] = await Promise.all([fetchCategories(), fetchAssignees(), fetchAllCategoryStages(), fetchPostseasonLogs()]);
      setCategories(cats);
      setAssignees(ass);
      setStages(stg);
      setPostLogs(logs);
    } catch (err: any) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function togglePost(categoryId: string, weekMondayISO: string, stageType: StageType) {
    // optimistic
    setPostLogs((prev) => {
      const exists = prev.find((l) => l.category_id === categoryId && l.week_monday === weekMondayISO && l.stage_type === stageType);
      if (exists) return prev.filter((l) => l !== exists);
      return [...prev, { id: 'tmp', category_id: categoryId, week_monday: weekMondayISO, stage_type: stageType }];
    });
    try { await togglePostseasonLog(categoryId, weekMondayISO, stageType); }
    catch (e: any) { alert('저장 실패: ' + e.message); loadAll(); }
  }
  useEffect(() => { setToday(new Date()); loadAll(); }, []);

  async function toggleStatus(view: StageView) {
    const next: TaskStatus = view.status === 'todo' ? 'in_progress' : view.status === 'in_progress' ? 'done' : 'todo';
    setStages((prev) => {
      const idx = prev.findIndex((s) => s.category_id === view.categoryId && s.stage_type === view.stageType);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = { ...copy[idx], status: next }; return copy; }
      return [...prev, { id: '', category_id: view.categoryId, stage_type: view.stageType, status: next, assignee_id: view.assigneeId }];
    });
    try { await updateCategoryStage(view.categoryId, view.stageType, { status: next }); }
    catch (e: any) { alert('저장 실패: ' + e.message); loadAll(); }
  }

  if (!today || loading) {
    return <div className="flex items-center justify-center min-h-screen bg-white"><p className="text-[#737373] font-mono text-xs tracking-[0.15em] uppercase">LOADING…</p></div>;
  }
  if (error) {
    return <div className="flex items-center justify-center min-h-screen bg-white px-6"><div className="text-center max-w-md p-8" style={{ border: STRONG_BORDER }}><div className="font-mono text-xs tracking-[0.2em] uppercase text-[#737373] mb-3">ERROR</div><p className="text-black text-sm">{error}</p></div></div>;
  }

  const isSimulating = simDate !== null;
  const displayDate = simDate ?? today;
  const todayStr = formatDate(displayDate);

  const seasonCats = categories.filter((c) => c.track !== 'postseason' && c.peak_date);
  const postseason = categories.filter((c) => c.track === 'postseason');
  const allViews = buildAllStageViews(categories, stages, displayDate);
  const grouped = groupByUrgency(allViews);
  const actionableCount = grouped.overdue.length + grouped.thisweek.length;
  const assigneeName = (id: string | null) => (id ? assignees.find((a) => a.id === id)?.name ?? id : null);

  return (
    <main className="bg-white text-black min-h-screen">
      <div className="mx-auto px-6 md:px-10 py-12" style={{ maxWidth: view === 'grid' ? 1380 : 1280 }}>
        {isSimulating && (
          <div className="bg-black text-white px-5 py-3 mb-6 flex justify-between items-center" style={{ border: STRONG_BORDER }}>
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase font-medium">★ SIMULATION · {todayStr} 기준 미리보기</div>
            <button onClick={() => setSimDate(null)} className="font-mono text-[11px] tracking-[0.15em] uppercase border border-white px-3 py-1 hover:bg-white hover:text-black transition-colors">오늘로</button>
          </div>
        )}

        {/* HEADER */}
        <header className="flex justify-between items-start pb-5 mb-6" style={{ borderBottom: STRONG_BORDER }}>
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-[#737373] uppercase mb-2 font-medium">Heavy Duty · Operating Timetable</div>
            <h1 className="text-[40px] font-bold tracking-[-0.025em] leading-[1.0]">운영 시간표</h1>
          </div>
          <div className="text-right pt-1">
            <div className="font-mono text-xs text-[#737373] tabular">{todayStr}</div>
            <div className="mt-3 flex flex-col items-end gap-1">
              <label className="font-mono text-[9px] tracking-[0.2em] text-[#737373] uppercase font-medium">Simulate Date</label>
              <input type="date" value={dateToInputValue(displayDate)} onChange={(e) => { const [y, m, d] = e.target.value.split('-').map(Number); if (y && m && d) setSimDate(new Date(y, m - 1, d)); }} className="text-xs px-2 py-1 font-mono tabular text-black bg-white" style={{ border: '2px solid #A3A3A3' }} />
            </div>
          </div>
        </header>

        {/* 상단 바: 급한 것 요약 + 뷰 토글 + 관리자 */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg">지금 챙길 것 <span className="text-2xl tabular">{actionableCount}</span>건</span>
            <span className="font-mono text-xs text-[#737373] tabular">🔴 지난 {grouped.overdue.length} · 🟠 이번주 {grouped.thisweek.length} · 🟡 2주내 {grouped.soon.length}</span>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex" style={{ border: STRONG_BORDER }}>
              <button onClick={() => setView('grid')} className={`px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase font-bold ${view === 'grid' ? 'bg-black text-white' : 'bg-white text-black'}`}>📅 시간표</button>
              <button onClick={() => setView('radar')} className={`px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase font-bold ${view === 'radar' ? 'bg-black text-white' : 'bg-white text-black'}`} style={{ borderLeft: '2px solid #000' }}>🔴 급한 것</button>
            </div>
            <Link href="/admin" className="font-mono text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border-2 border-black hover:bg-black hover:text-white transition-colors">관리자</Link>
          </div>
        </div>

        {view === 'grid' ? (
          <GridView
            seasonCats={seasonCats}
            postCats={postseason}
            stages={stages}
            postLogs={postLogs}
            assignees={assignees}
            contentTasks={contentTasks}
            today={displayDate}
            expanded={expanded}
            setExpanded={openCategory}
            assigneeName={assigneeName}
            onToggle={toggleStatus}
            onOpenPostPicker={(catId, iso, x, y) => setPostPicker({ catId, iso, x, y })}
            onChangeContent={changeContentTask}
          />
        ) : (
          <RadarView grouped={grouped} assigneeName={assigneeName} onToggle={toggleStatus} />
        )}

        {/* 포시즌 단계 선택 팝업 */}
        {postPicker && (() => {
          const cat = categories.find((c) => c.id === postPicker.catId);
          const wkDate = (() => { const [y, m, d] = postPicker.iso.split('-').map(Number); return new Date(y, m - 1, d); })();
          const checked = (st: StageType) => postLogs.some((l) => l.category_id === postPicker.catId && l.week_monday === postPicker.iso && l.stage_type === st);
          const left = Math.min(postPicker.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320);
          const top = postPicker.y + 10;
          return (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPostPicker(null)} />
              <div className="fixed z-50 bg-white p-3" style={{ left, top, border: STRONG_BORDER, boxShadow: '0 6px 24px rgba(0,0,0,0.18)' }}>
                <div className="font-mono text-[10px] text-[#737373] mb-2 tracking-wide flex items-center justify-between gap-4">
                  <span><b className="text-black">{cat?.name}</b> · {wkDate.getMonth() + 1}/{wkDate.getDate()} 주</span>
                  <button onClick={() => setPostPicker(null)} className="text-[#737373] hover:text-black">✕</button>
                </div>
                <div className="flex gap-1.5">
                  {STAGE_DEFS.map((def) => {
                    const on = checked(def.type);
                    return (
                      <button
                        key={def.type}
                        onClick={() => togglePost(postPicker.catId, postPicker.iso, def.type)}
                        className="flex flex-col items-center px-2.5 py-2 transition-colors"
                        style={{ border: on ? '2px solid #1A7F37' : '1.5px solid #D4D4D4', background: on ? '#E8F3EC' : '#FFF', minWidth: 48 }}
                        title={def.label}
                      >
                        <span className="text-[18px] leading-none">{STAGE_ICON[def.type]}</span>
                        <span className="text-[10px] mt-1 font-bold" style={{ color: on ? '#1A7F37' : '#404040' }}>{def.short}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="font-mono text-[9px] text-[#A3A3A3] mt-2 tracking-wide">눌러서 켜고 끄기 · 여러 개 선택 가능</div>
              </div>
            </>
          );
        })()}

        {/* 포시즌 풀 */}
        <section className="mb-12 mt-10">
          <div className="flex items-baseline justify-between mb-4 pb-3" style={{ borderBottom: STRONG_BORDER }}>
            <h2 className="text-lg font-bold tracking-[-0.01em]">포시즌 풀 <span className="font-mono text-xs text-[#737373] ml-2">매주 빈 슬롯에 투입</span></h2>
            <span className="font-mono text-xs text-[#737373] tabular">{postseason.length}종</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {postseason.map((c) => (
              <Link key={c.id} href={`/category/${c.id}`} className="px-5 py-3 hover:bg-[#F5F5F5] transition-colors" style={{ border: CARD_BORDER }}>
                <span className="font-bold text-base">{c.name}</span>
                <span className="font-mono text-[10px] text-[#737373] ml-2 tracking-wider">{c.subtitle}</span>
              </Link>
            ))}
          </div>
        </section>

        <footer className="mt-16 pt-6 font-mono text-[10px] text-[#737373] tracking-[0.15em] uppercase flex justify-between tabular" style={{ borderTop: STRONG_BORDER }}>
          <span>HEAVY DUTY ARCHIVE · TIMETABLE</span>
          <span>{todayStr}</span>
        </footer>
      </div>
    </main>
  );
}

// ============================================================
// 그리드 뷰 — 가로 주차 × 세로 카테고리
// ============================================================
function GridView({
  seasonCats, postCats, stages, postLogs, assignees, contentTasks, today, expanded, setExpanded, assigneeName, onToggle, onOpenPostPicker, onChangeContent,
}: {
  seasonCats: Category[];
  postCats: Category[];
  stages: CategoryStage[];
  postLogs: PostseasonLog[];
  assignees: Assignee[];
  contentTasks: ContentTask[];
  today: Date;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  assigneeName: (id: string | null) => string | null;
  onToggle: (v: StageView) => void;
  onOpenPostPicker: (categoryId: string, weekMondayISO: string, x: number, y: number) => void;
  onChangeContent: (categoryId: string, day: string, patch: { assignee_id?: string | null; done?: boolean }) => void;
}) {
  // 카테고리별 단계 뷰 미리 계산
  const stagesByCat: Record<string, StageView[]> = {};
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  for (const cat of seasonCats) {
    const catStages = stages.filter((s) => s.category_id === cat.id);
    const views = buildStageViews(cat, catStages, today);
    stagesByCat[cat.id] = views;
    for (const v of views) {
      if (!minDate || v.deadline < minDate) minDate = v.deadline;
      if (!maxDate || v.deadline > maxDate) maxDate = v.deadline;
    }
    // 정점 날짜도 그리드 범위에 포함 (정점 표시용)
    if (cat.peak_date) {
      const pk = new Date(cat.peak_date);
      if (!maxDate || pk > maxDate) maxDate = pk;
    }
  }
  if (!minDate || !maxDate) return <p className="text-[#A3A3A3]">시즌 카테고리가 없습니다.</p>;

  const weeks = weeksBetween(minDate, maxDate);
  const todayWeekIdx = weekIndexOf(weeks, today);
  const monthGroups = groupWeeksByMonth(weeks);
  const COL_W = 50;
  const MIN_COL = 44;  // 주차 칸 최소폭 (이보다 좁아지면 가로 스크롤)
  const CAT_W = 124;

  // 각 주가 몇 번째 월 그룹인지 (월별 줄무늬용)
  const monthOfWeek: number[] = [];
  monthGroups.forEach((g, gi) => { for (let k = 0; k < g.count; k++) monthOfWeek[g.startIdx + k] = gi; });

  // 완료/진행/대기 셀 색
  const cellStyleFor = (v: StageView): { bg: string; fg: string; mark: string } => {
    if (v.status === 'done') return { bg: '#1A7F37', fg: '#FFFFFF', mark: '✓' };       // 완료 = 초록
    if (v.status === 'in_progress') return { bg: '#FFC400', fg: '#000000', mark: '●' }; // 진행 = 노랑
    return { bg: '#FFFFFF', fg: '#000000', mark: '○' };                                  // 대기 = 흰
  };

  return (
    <>
    {/* 범례 */}
    <div className="flex gap-x-5 gap-y-2 flex-wrap mb-3 items-center text-[12px] text-[#404040]">
      <span className="font-bold text-black tracking-widest uppercase text-[10px]">범례</span>
      <span>📦 발주</span><span>🚚 배송</span><span>🏷️ 케어</span><span>✏️ 제작</span><span>📣 발행</span><span>🎯 정점</span>
      <span className="flex items-center gap-1.5"><span style={{display:'inline-block',width:12,height:12,background:'#FFFFFF',border:'1.5px solid #A3A3A3'}}></span>대기</span>
      <span className="flex items-center gap-1.5"><span style={{display:'inline-block',width:12,height:12,background:'#FFC400'}}></span>진행</span>
      <span className="flex items-center gap-1.5"><span style={{display:'inline-block',width:12,height:12,background:'#1A7F37'}}></span>완료</span>
    </div>
    <div className="overflow-x-auto" style={{ border: STRONG_BORDER }}>
      <div style={{ minWidth: CAT_W + weeks.length * MIN_COL }}>
        {/* 월 대분류 헤더 */}
        <div className="flex" style={{ background: '#000' }}>
          <div className="shrink-0" style={{ width: CAT_W, position: 'sticky', left: 0, background: '#000', zIndex: 3 }} />
          {monthGroups.map((g, gi) => (
            <div key={gi} className="text-center py-1.5 font-bold text-white text-[13px]" style={{ flex: g.count, minWidth: g.count * MIN_COL, borderLeft: gi > 0 ? '2px solid #FFF' : 'none' }}>
              {g.month}월
            </div>
          ))}
        </div>
        {/* 주차 헤더 */}
        <div className="flex" style={{ borderBottom: STRONG_BORDER, background: '#F0F0F0' }}>
          <div className="shrink-0 px-3 py-2 font-mono text-[10px] tracking-widest uppercase text-[#737373] font-bold flex items-center" style={{ width: CAT_W, position: 'sticky', left: 0, background: '#F0F0F0', borderRight: '2px solid #000', zIndex: 2 }}>
            카테고리
          </div>
          {weeks.map((w, i) => {
            const isToday = i === todayWeekIdx;
            const { week } = weekColLabel(w);
            const monthStart = monthGroups.find((g) => g.startIdx === i);
            return (
              <div key={i} className="text-center py-2 font-mono text-[11px] tabular font-bold" style={{ flex: 1, minWidth: MIN_COL, background: isToday ? '#C0392B' : '#F0F0F0', color: isToday ? '#FFF' : '#000', borderLeft: monthStart && i > 0 ? '2px solid #000' : '1px solid #D4D4D4' }}>
                {week}주
                {isToday && <div className="text-[7px] tracking-wider mt-0.5">오늘</div>}
              </div>
            );
          })}
        </div>

        {/* 카테고리 행 */}
        {seasonCats.map((cat, catIdx) => {
          const views = stagesByCat[cat.id];
          const cellByWeek: Record<number, StageView> = {};
          let minWi = Infinity, maxWi = -Infinity;
          for (const v of views) {
            const wi = weekIndexOf(weeks, v.deadline);
            if (wi >= 0) { cellByWeek[wi] = v; minWi = Math.min(minWi, wi); maxWi = Math.max(maxWi, wi); }
          }
          const isExpanded = expanded === cat.id;
          const contents = cat.peak_date ? publishContents(new Date(cat.peak_date)) : [];
          const peakWi = cat.peak_date ? weekIndexOf(weeks, new Date(cat.peak_date)) : -1;
          const cc = catColor(catIdx);
          const rowBg = `${cc}10`;  // 카테고리 색 아주 옅게 (행 전체 옅은 틴트)
          return (
            <div key={cat.id}>
              <div className="flex items-stretch" style={{ borderBottom: '2px solid #C8C8C8' }}>
                {/* 카테고리명 (sticky) — 좌측 컬러 바 */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : cat.id)}
                  className="shrink-0 pr-3 py-3 text-left transition-colors flex flex-col justify-center"
                  style={{ width: CAT_W, position: 'sticky', left: 0, background: isExpanded ? '#EFEFEF' : '#FFF', borderRight: '2px solid #000', borderLeft: `7px solid ${cc}`, paddingLeft: 10, zIndex: 1 }}
                >
                  <span className="font-bold text-[13px] leading-tight" style={{ color: cc }}>{cat.name}</span>
                  <span className="font-mono text-[9px] text-[#737373] tracking-wide mt-0.5">{isExpanded ? '▾ 콘텐츠 닫기' : '🎯 정점 ' + (cat.peak_date?.slice(5).replace('-', '/') ?? '')}</span>
                </button>
                {/* 주차 셀 */}
                {weeks.map((w, i) => {
                  const v = cellByWeek[i];
                  const isToday = i === todayWeekIdx;
                  const isPeak = i === peakWi;
                  const monthStart = monthGroups.find((g) => g.startIdx === i);
                  const leftBorder = monthStart && i > 0 ? '2px solid #000' : '1px solid #EDEDED';

                  // 정점 칸 (단계 없는 정점 주) — 마일스톤 표시
                  if (isPeak && !v) {
                    return (
                      <div key={i} className="flex flex-col items-center justify-center py-2" title={`${cat.name} 검색량 정점 (${cat.peak_date})`} style={{ flex: 1, minWidth: MIN_COL, borderLeft: leftBorder, background: '#000', color: '#FFF' }}>
                        <span className="text-[15px] leading-none">🎯</span>
                        <span className="text-[8px] leading-none mt-1 font-bold tracking-wider">정점</span>
                      </div>
                    );
                  }
                  if (!v) {
                    const bg = isToday ? '#FBE9E7' : rowBg;
                    return <div key={i} style={{ flex: 1, minWidth: MIN_COL, borderLeft: leftBorder, background: bg }} />;
                  }
                  const cs = cellStyleFor(v);
                  const urgentUndone = v.status !== 'done' && (v.urgency === 'overdue' || v.urgency === 'thisweek');
                  return (
                    <button
                      key={i}
                      onClick={() => onToggle(v)}
                      title={`${cat.name} · ${v.def.label} · ${formatDeadline(v.deadline)} · ${v.status === 'done' ? '완료' : daysLeftLabel(v.daysLeft)} · 클릭=상태변경`}
                      className="flex flex-col items-center justify-center py-2 transition-opacity hover:opacity-80 relative"
                      style={{ flex: 1, minWidth: MIN_COL, background: cs.bg, color: cs.fg, borderLeft: leftBorder, boxShadow: urgentUndone ? 'inset 0 3px 0 0 #C0392B' : undefined }}
                    >
                      <span className="text-[17px] leading-none">{STAGE_ICON[v.stageType]}</span>
                      <span className="text-[13px] leading-none mt-1 font-bold">{cs.mark}</span>
                    </button>
                  );
                })}
              </div>

              {/* 펼친 콘텐츠 6개 — 담당자 지정 + 완료 체크 */}
              {isExpanded && (
                <div className="flex" style={{ borderBottom: '2px solid #C8C8C8', background: '#FAFAFA' }}>
                  <div className="shrink-0 px-3 py-3 font-mono text-[9px] text-[#737373] tracking-wide" style={{ width: CAT_W, position: 'sticky', left: 0, background: '#FAFAFA', borderRight: '2px solid #000', zIndex: 1 }}>
                    📣 발행 6콘텐츠
                  </div>
                  <div className="flex-1 px-4 py-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {contents.map((c) => {
                        const task = contentTasks.find((t) => t.category_id === cat.id && t.content_day === c.day);
                        const done = task?.done ?? false;
                        return (
                          <div key={c.day} className="flex items-center gap-2 px-3 py-2" style={{ border: '1.5px solid #A3A3A3', background: done ? '#EAF6EC' : '#FFF', opacity: done ? 0.85 : 1 }}>
                            {/* 완료 체크 */}
                            <button
                              onClick={() => onChangeContent(cat.id, c.day, { done: !done })}
                              className="shrink-0 font-mono text-[11px] font-bold w-6 h-6 flex items-center justify-center"
                              style={{ background: done ? '#1A7F37' : '#FFF', color: done ? '#FFF' : '#000', border: '1.5px solid #000' }}
                              title="완료 체크"
                            >
                              {done ? '✓' : ''}
                            </button>
                            <span className="font-mono text-[10px] text-[#737373] w-3">{c.day}</span>
                            <span className="text-[12px] font-semibold flex-1" style={{ textDecoration: done ? 'line-through' : undefined }}>{c.type}</span>
                            {/* 담당자 드롭다운 */}
                            <select
                              value={task?.assignee_id || ''}
                              onChange={(e) => onChangeContent(cat.id, c.day, { assignee_id: e.target.value || null })}
                              className="text-[11px] font-semibold px-1.5 py-1 bg-white shrink-0"
                              style={{ border: '1.5px solid #A3A3A3', maxWidth: 64 }}
                            >
                              <option value="">담당 —</option>
                              {assignees.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* ── 포시즌 행 (청바지·모자·폴로) — 칸 클릭으로 단계 선택 ── */}
        {postCats.length > 0 && (
          <div className="flex" style={{ borderTop: '3px solid #000', background: '#EEE' }}>
            <div className="shrink-0 px-3 py-1.5 font-mono text-[9px] tracking-widest uppercase text-[#737373] font-bold" style={{ width: CAT_W, position: 'sticky', left: 0, background: '#EEE', borderRight: '2px solid #000', zIndex: 1 }}>
              포시즌 (칸 클릭 = 단계 선택)
            </div>
            <div style={{ flex: 1 }} />
          </div>
        )}
        {postCats.map((cat, pi) => {
          const cc = catColor(seasonCats.length + pi);
          const rowBg = `${cc}10`;
          // 주(iso) → 체크된 단계 집합 (STAGE_DEFS 순서대로 정렬)
          const stagesByWeek: Record<string, StageType[]> = {};
          for (const l of postLogs) {
            if (l.category_id !== cat.id) continue;
            (stagesByWeek[l.week_monday] ||= []).push(l.stage_type);
          }
          const orderIdx = (st: StageType) => STAGE_DEFS.findIndex((d) => d.type === st);
          return (
            <div key={cat.id} className="flex items-stretch" style={{ borderBottom: '1px solid #D4D4D4' }}>
              <div className="shrink-0 pr-3 py-2.5 text-left flex flex-col justify-center" style={{ width: CAT_W, position: 'sticky', left: 0, background: '#FFF', borderRight: '2px solid #000', borderLeft: `7px solid ${cc}`, paddingLeft: 10, zIndex: 1 }}>
                <span className="font-bold text-[13px] leading-tight" style={{ color: cc }}>{cat.name}</span>
                <span className="font-mono text-[9px] text-[#737373] tracking-wide mt-0.5">포시즌</span>
              </div>
              {weeks.map((w, i) => {
                const iso = `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}-${String(w.getDate()).padStart(2, '0')}`;
                const cellStages = (stagesByWeek[iso] || []).slice().sort((a, b) => orderIdx(a) - orderIdx(b));
                const has = cellStages.length > 0;
                const isToday = i === todayWeekIdx;
                const monthStart = monthGroups.find((g) => g.startIdx === i);
                const leftBorder = monthStart && i > 0 ? '2px solid #000' : '1px solid #EDEDED';
                return (
                  <button
                    key={i}
                    onClick={(e) => onOpenPostPicker(cat.id, iso, e.clientX, e.clientY)}
                    title={`${cat.name} · ${w.getMonth() + 1}/${w.getDate()} 주${has ? ' · ' + cellStages.map((s) => STAGE_SHORT[s]).join(',') : ''} · 클릭=단계 선택`}
                    className="flex flex-wrap items-center justify-center py-2 px-0.5 gap-0.5 transition-opacity hover:opacity-70"
                    style={{ flex: 1, minWidth: MIN_COL, borderLeft: leftBorder, background: has ? '#E8F3EC' : (isToday ? '#FBE9E7' : rowBg) }}
                  >
                    {has
                      ? cellStages.map((s) => <span key={s} className="text-[13px] leading-none">{STAGE_ICON[s]}</span>)
                      : <span className="text-[#C8C8C8] text-[13px] leading-none">+</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

// ============================================================
// 레이더 뷰 (급한 것 목록) — 긴급도별
// ============================================================
function RadarView({
  grouped, assigneeName, onToggle,
}: {
  grouped: ReturnType<typeof groupByUrgency>;
  assigneeName: (id: string | null) => string | null;
  onToggle: (v: StageView) => void;
}) {
  return (
    <div>
      <UrgencySection title={URGENCY_LABEL.overdue} urgency="overdue" views={grouped.overdue} assigneeName={assigneeName} onToggle={onToggle} />
      <UrgencySection title={URGENCY_LABEL.thisweek} urgency="thisweek" views={grouped.thisweek} assigneeName={assigneeName} onToggle={onToggle} />
      <UrgencySection title={URGENCY_LABEL.soon} urgency="soon" views={grouped.soon} assigneeName={assigneeName} onToggle={onToggle} />
      <UrgencySection title={URGENCY_LABEL.later} urgency="later" views={grouped.later} assigneeName={assigneeName} onToggle={onToggle} compact />
      <UrgencySection title={URGENCY_LABEL.done} urgency="done" views={grouped.done} assigneeName={assigneeName} onToggle={onToggle} compact />
    </div>
  );
}

function UrgencySection({ title, urgency, views, assigneeName, onToggle, compact }: { title: string; urgency: Urgency; views: StageView[]; assigneeName: (id: string | null) => string | null; onToggle: (v: StageView) => void; compact?: boolean; }) {
  if (views.length === 0) return null;
  const style = URGENCY_STYLE[urgency];
  return (
    <section className="mb-8">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-lg">{style.mark}</span>
        <h2 className={`font-bold tracking-[-0.01em] ${compact ? 'text-base text-[#737373]' : 'text-2xl'}`}>{title}</h2>
        <span className="font-mono text-xs text-[#737373] tabular">{views.length}건</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {views.map((v) => <StageRow key={`${v.categoryId}-${v.stageType}`} view={v} assigneeName={assigneeName} onToggle={onToggle} compact={compact} />)}
      </div>
    </section>
  );
}

function StageRow({ view, assigneeName, onToggle, compact }: { view: StageView; assigneeName: (id: string | null) => string | null; onToggle: (v: StageView) => void; compact?: boolean; }) {
  const style = URGENCY_STYLE[view.urgency];
  const name = assigneeName(view.assigneeId);
  const isOps = view.def.track === 'ops';
  return (
    <div className="p-4 flex items-center gap-3 transition-all" style={{ background: style.bg, color: style.fg, border: `2px solid ${style.border}` }}>
      <Link href={`/category/${view.categoryId}`} className="flex-1 min-w-0 hover:opacity-70">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-bold leading-tight ${compact ? 'text-sm' : 'text-[17px]'}`} style={{ textDecoration: view.status === 'done' ? 'line-through' : undefined }}>{view.categoryName}</span>
          <span className="font-mono text-[9px] tracking-[0.1em] uppercase px-1.5 py-0.5 font-bold" style={{ background: isOps ? (view.urgency === 'overdue' ? '#FFF' : '#000') : 'transparent', color: isOps ? (view.urgency === 'overdue' ? '#000' : '#FFF') : style.fg, border: isOps ? 'none' : `1px solid ${style.fg}` }}>{TRACK_LABEL[view.def.track]}</span>
        </div>
        <div className={`font-semibold ${compact ? 'text-xs' : 'text-sm'}`}>{view.def.label}</div>
      </Link>
      <div className="text-right whitespace-nowrap">
        <div className="font-mono text-[11px] tabular font-bold">{formatDeadline(view.deadline)}</div>
        <div className="font-mono text-[10px] tabular" style={{ opacity: 0.75 }}>{view.status === 'done' ? '완료' : daysLeftLabel(view.daysLeft)}</div>
        {name && <div className="font-mono text-[10px] mt-0.5 font-bold">{name}</div>}
      </div>
      <button onClick={() => onToggle(view)} className="font-mono text-[10px] tracking-wide uppercase px-2.5 py-2 font-bold whitespace-nowrap transition-opacity hover:opacity-70" style={{ background: view.status === 'done' ? '#000' : view.status === 'in_progress' ? '#FFF' : 'transparent', color: view.status === 'done' ? '#FFF' : style.fg, border: `1.5px solid ${style.fg}` }} title="상태 변경">
        {view.status === 'todo' ? '○ 대기' : view.status === 'in_progress' ? '● 진행' : '✓ 완료'}
      </button>
    </div>
  );
}
