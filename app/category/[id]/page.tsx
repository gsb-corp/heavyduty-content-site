'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Assignee, ProgressItem, TaskStatus, CategoryStage, Category, StageType } from '@/lib/data/types';
import { STATUS_LABEL, TRACK_LABEL } from '@/lib/data/types';
import {
  fetchAssignees,
  fetchProgressItems,
  addProgressItem,
  updateProgressItem,
  deleteProgressItem,
  fetchCategoryStages,
  updateCategoryStage,
} from '@/lib/utils/queries';
import { buildStageViews, formatDeadline, daysLeftLabel, type StageView } from '@/lib/utils/pipeline';

const CARD_BORDER = '2px solid #A3A3A3';
const STRONG_BORDER = '2px solid #000';

export default function CategoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [category, setCategory] = useState<Category | null>(null);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [stages, setStages] = useState<CategoryStage[]>([]);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newProgress, setNewProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [today] = useState(() => new Date());

  async function loadAll() {
    setLoading(true);
    try {
      const { data: cat, error: catErr } = await supabase
        .from('categories')
        .select('id, name, subtitle, season, reliability, keywords, assignee_id, peak_date, track')
        .eq('id', id)
        .single();
      if (catErr) throw catErr;
      setCategory({ ...cat, cycles: [] } as unknown as Category);

      const [ass, stg, prog] = await Promise.all([
        fetchAssignees(),
        fetchCategoryStages(id),
        fetchProgressItems(id),
      ]);
      setAssignees(ass);
      setStages(stg);
      setProgress(prog);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  async function changeStage(stageType: StageType, patch: { status?: TaskStatus; assignee_id?: string | null }) {
    setStages((prev) => {
      const idx = prev.findIndex((s) => s.stage_type === stageType);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], ...patch };
        return copy;
      }
      return [...prev, { id: '', category_id: id, stage_type: stageType, status: 'todo', assignee_id: null, ...patch }];
    });
    try {
      await updateCategoryStage(id, stageType, patch);
    } catch (e: any) {
      alert('저장 실패: ' + e.message);
      loadAll();
    }
  }

  async function addProg() {
    if (!newProgress.trim()) return;
    await addProgressItem(id, newProgress.trim());
    setNewProgress('');
    loadAll();
  }
  async function toggleProg(item: ProgressItem) {
    const next: TaskStatus = item.status === 'todo' ? 'in_progress' : item.status === 'in_progress' ? 'done' : 'todo';
    await updateProgressItem(item.id, { status: next });
    loadAll();
  }
  async function delProg(itemId: string) {
    await deleteProgressItem(itemId);
    loadAll();
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-white"><p className="text-[#737373] font-mono text-xs tracking-[0.15em] uppercase">LOADING…</p></div>;
  }
  if (error || !category) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white px-6">
        <div className="max-w-md p-8 text-center" style={{ border: STRONG_BORDER }}>
          <div className="font-mono text-xs tracking-[0.2em] uppercase text-[#737373] mb-3">ERROR</div>
          <p className="text-black text-sm mb-4">{error || 'Category not found'}</p>
          <Link href="/" className="font-mono text-xs underline">← 대시보드로</Link>
        </div>
      </div>
    );
  }

  const isSeason = category.track !== 'postseason' && !!category.peak_date;
  const stageViews = isSeason ? buildStageViews(category, stages, today) : [];

  return (
    <main className="bg-white text-black min-h-screen">
      <div className="max-w-[1000px] mx-auto px-6 md:px-12 py-16">
        {/* 상단 네비 */}
        <div className="mb-10 flex justify-between items-center">
          <Link href="/" className="font-mono text-xs tracking-[0.15em] uppercase hover:underline">← 데드라인 레이더</Link>
          <Link href="/admin" className="font-mono text-[10px] tracking-[0.15em] uppercase px-3 py-1.5 border-2 border-black hover:bg-black hover:text-white transition-colors">관리자</Link>
        </div>

        {/* HEADER */}
        <header className="pb-6 mb-12" style={{ borderBottom: STRONG_BORDER }}>
          <div className="font-mono text-[11px] tracking-[0.2em] text-[#737373] uppercase mb-3 font-medium">{category.subtitle}</div>
          <h1 className="text-[48px] font-bold tracking-[-0.025em] leading-[1.0]">{category.name}</h1>
          <div className="mt-4 flex gap-3 text-xs font-mono text-[#737373] tabular tracking-wider items-center flex-wrap">
            <span>SEASON · {category.season}</span>
            <span>·</span>
            {isSeason ? (
              <span>정점 · {category.peak_date}</span>
            ) : (
              <span className="px-2 py-0.5 bg-[#E8F0FF] text-[#000] font-bold">포시즌 · 빈 슬롯 투입</span>
            )}
          </div>
        </header>

        {/* 시즌 카테고리 — 파이프라인 5단계 */}
        {isSeason ? (
          <section className="mb-16">
            <div className="flex items-baseline justify-between mb-6 pb-3" style={{ borderBottom: STRONG_BORDER }}>
              <h2 className="text-2xl font-bold tracking-[-0.01em]">운영 파이프라인</h2>
              <span className="font-mono text-xs text-[#737373] tabular tracking-wider">정점 -10주 → 발행</span>
            </div>
            <div className="space-y-3">
              {stageViews.map((v) => (
                <PipelineStageRow key={v.stageType} view={v} assignees={assignees} onChange={changeStage} />
              ))}
            </div>
          </section>
        ) : (
          <section className="mb-16">
            <div className="box p-6" style={{ border: '2px dashed #A3A3A3' }}>
              <h3 className="font-bold text-lg mb-2">포시즌 카테고리</h3>
              <p className="text-sm text-[#404040] leading-relaxed">
                이 카테고리는 고정 발행 주차가 없습니다. 시즌 카테고리 발행이 없는 주에 적절한 수량으로 콘텐츠에 투입합니다.
                사입 입고 시점에 맞춰 자유롭게 운영하세요.
              </p>
            </div>
          </section>
        )}

        {/* 진행 항목 (자유 추가 — 콘텐츠 6개 등) */}
        <section className="mb-16">
          <div className="flex items-baseline justify-between mb-6 pb-3" style={{ borderBottom: STRONG_BORDER }}>
            <h2 className="text-2xl font-bold tracking-[-0.01em]">진행 항목</h2>
            <span className="font-mono text-xs text-[#737373] tabular tracking-wider">
              {progress.filter((p) => p.status === 'done').length} / {progress.length} 완료
            </span>
          </div>
          <div className="mb-6 flex gap-2">
            <input
              type="text"
              value={newProgress}
              onChange={(e) => setNewProgress(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProg()}
              placeholder="예: 8/17 (월) 제품 업데이트 / 사진 촬영 30장"
              className="flex-1 px-4 py-3 text-sm bg-white"
              style={{ border: '2px solid #A3A3A3' }}
            />
            <button onClick={addProg} className="px-5 py-3 bg-black text-white font-mono text-xs tracking-widest uppercase hover:opacity-80 transition-opacity">추가</button>
          </div>
          {progress.length === 0 ? (
            <p className="text-[#A3A3A3] text-sm">아직 진행 항목이 없습니다. 콘텐츠 6개(월·화·수·목·금·일) 등을 추가하세요.</p>
          ) : (
            <ul>
              {progress.map((p, i) => (
                <li key={p.id} className="py-3 flex items-center gap-4" style={i !== progress.length - 1 ? { borderBottom: '1.5px solid #A3A3A3' } : undefined}>
                  <button
                    onClick={() => toggleProg(p)}
                    className="font-mono text-[10px] tracking-wide uppercase px-2.5 py-1.5 font-bold whitespace-nowrap"
                    style={{
                      background: p.status === 'done' ? '#000' : p.status === 'in_progress' ? '#FFF' : 'transparent',
                      color: p.status === 'done' ? '#FFF' : '#000',
                      border: '1.5px solid #000',
                    }}
                  >
                    {p.status === 'todo' ? '○ 대기' : p.status === 'in_progress' ? '● 진행' : '✓ 완료'}
                  </button>
                  <span className={`flex-1 text-sm ${p.status === 'done' ? 'line-through text-[#A3A3A3]' : 'text-black'}`}>{p.label}</span>
                  <button onClick={() => delProg(p.id)} className="font-mono text-[10px] text-[#737373] tracking-widest uppercase hover:text-black">삭제</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-32 pt-6 font-mono text-[10px] text-[#737373] tracking-[0.15em] uppercase flex justify-between tabular" style={{ borderTop: STRONG_BORDER }}>
          <span>HEAVY DUTY ARCHIVE</span>
          <span>{category.id}</span>
        </footer>
      </div>
    </main>
  );
}

function PipelineStageRow({
  view,
  assignees,
  onChange,
}: {
  view: StageView;
  assignees: Assignee[];
  onChange: (stageType: StageType, patch: { status?: TaskStatus; assignee_id?: string | null }) => void;
}) {
  const isOps = view.def.track === 'ops';
  const isDone = view.status === 'done';
  const isOverdue = view.urgency === 'overdue';
  const isInProgress = view.status === 'in_progress';

  return (
    <div
      className="p-4 flex items-center gap-4 flex-wrap transition-all"
      style={{
        border: isOverdue ? '2px solid #000' : '2px solid #A3A3A3',
        background: isOverdue ? '#FFD6D6' : isInProgress ? '#F5F5F5' : '#FFF',
        opacity: isDone ? 0.6 : 1,
      }}
    >
      {/* 단계명 + 트랙 */}
      <div className="flex items-center gap-2 w-44">
        <span className="font-mono text-[10px] tracking-[0.1em] uppercase px-1.5 py-0.5 font-bold" style={{ background: isOps ? '#000' : '#FFF', color: isOps ? '#FFF' : '#000', border: isOps ? 'none' : '1px solid #000' }}>
          {TRACK_LABEL[view.def.track]}
        </span>
        <span className="font-bold text-[15px]" style={{ textDecoration: isDone ? 'line-through' : undefined }}>{view.def.label}</span>
      </div>

      {/* 데드라인 */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[12px] tabular font-bold">{formatDeadline(view.deadline)}</div>
        <div className="font-mono text-[10px] tabular text-[#737373]">{isDone ? '완료' : daysLeftLabel(view.daysLeft)}</div>
      </div>

      {/* 담당자 셀렉트 */}
      <select
        value={view.assigneeId || ''}
        onChange={(e) => onChange(view.stageType, { assignee_id: e.target.value || null })}
        className="text-sm font-semibold px-2.5 py-1.5 cursor-pointer bg-white"
        style={{ border: '2px solid #A3A3A3', minWidth: 90 }}
      >
        <option value="">담당자 —</option>
        {assignees.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
      </select>

      {/* 상태 버튼 */}
      <button
        onClick={() => onChange(view.stageType, { status: view.status === 'todo' ? 'in_progress' : view.status === 'in_progress' ? 'done' : 'todo' })}
        className="font-mono text-[10px] tracking-wide uppercase px-3 py-2 font-bold whitespace-nowrap"
        style={{
          background: isDone ? '#000' : isInProgress ? '#FFF' : 'transparent',
          color: isDone ? '#FFF' : '#000',
          border: '1.5px solid #000',
        }}
      >
        {view.status === 'todo' ? '○ 대기' : view.status === 'in_progress' ? '● 진행' : '✓ 완료'}
      </button>
    </div>
  );
}
