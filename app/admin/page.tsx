'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { Assignee } from '@/lib/data/types';
import { fetchAssignees, addAssignee, deleteAssignee, setCategoryPeakDate } from '@/lib/utils/queries';
import { STAGE_DEFS, stageDeadlineLabel } from '@/lib/utils/admin-helpers';

const CARD_BORDER = '2px solid #A3A3A3';
const STRONG_BORDER = '2px solid #000';

interface CatRow {
  id: string;
  name: string;
  subtitle: string;
  season: string;
  peak_date: string | null;
  track: string | null;
  active: boolean;
  sort_order: number;
}

export default function AdminPage() {
  const [cats, setCats] = useState<CatRow[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, subtitle, season, peak_date, track, active, sort_order')
      .eq('active', true)
      .order('sort_order');
    if (error) { alert('로드 실패: ' + error.message); }
    else setCats((data || []) as CatRow[]);
    try { setAssignees(await fetchAssignees()); } catch {}
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function changePeak(id: string, value: string) {
    const peak = value || null;
    setCats((prev) => prev.map((c) => (c.id === id ? { ...c, peak_date: peak } : c)));
    try { await setCategoryPeakDate(id, peak); } catch (e: any) { alert('저장 실패: ' + e.message); loadAll(); }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-white"><p className="text-[#737373] font-mono text-xs tracking-[0.15em] uppercase">LOADING…</p></div>;
  }

  const season = cats.filter((c) => c.track !== 'postseason');
  const postseason = cats.filter((c) => c.track === 'postseason');

  return (
    <main className="bg-white text-black min-h-screen">
      <div className="max-w-[1100px] mx-auto px-6 md:px-12 py-16">
        <div className="mb-10 flex justify-between items-center">
          <Link href="/" className="font-mono text-xs tracking-[0.15em] uppercase hover:underline">← 데드라인 레이더</Link>
        </div>

        <header className="pb-6 mb-10" style={{ borderBottom: STRONG_BORDER }}>
          <div className="font-mono text-[11px] tracking-[0.2em] text-[#737373] uppercase mb-3 font-medium">Admin</div>
          <h1 className="text-[48px] font-bold tracking-[-0.025em] leading-[1.0]">관리자</h1>
          <p className="text-sm text-[#404040] mt-3">정점 날짜만 바꾸면 발주·배송·케어·제작·발행 데드라인이 모두 자동 재계산됩니다.</p>
        </header>

        {/* 담당자 */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-4 pb-3" style={{ borderBottom: STRONG_BORDER }}>
            <h2 className="text-2xl font-bold tracking-[-0.01em]">담당자</h2>
            <span className="font-mono text-xs text-[#737373] tabular">{assignees.length}명</span>
          </div>
          <AssigneesManager assignees={assignees} onChange={loadAll} />
        </section>

        {/* 시즌 카테고리 — 정점 날짜 수정 */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-4 pb-3" style={{ borderBottom: STRONG_BORDER }}>
            <h2 className="text-2xl font-bold tracking-[-0.01em]">시즌 카테고리 — 정점 날짜</h2>
            <span className="font-mono text-xs text-[#737373] tabular">{season.length}종</span>
          </div>
          <div className="space-y-3">
            {season.map((c) => (
              <div key={c.id} className="p-5" style={{ border: CARD_BORDER }}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-bold text-lg">{c.name}</div>
                    <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#737373] mt-1">{c.subtitle} · {c.season}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#737373]">정점 날짜</label>
                    <input
                      type="date"
                      value={c.peak_date || ''}
                      onChange={(e) => changePeak(c.id, e.target.value)}
                      className="text-sm px-3 py-2 font-mono tabular bg-white"
                      style={{ border: '2px solid #000' }}
                    />
                  </div>
                </div>
                {/* 자동 계산된 단계 데드라인 미리보기 */}
                {c.peak_date && (
                  <div className="mt-4 pt-3 flex gap-2 flex-wrap" style={{ borderTop: '1.5px solid #A3A3A3' }}>
                    {STAGE_DEFS.map((s) => (
                      <div key={s.type} className="px-2.5 py-1.5 bg-[#F5F5F5] text-center" style={{ border: '1px solid #D4D4D4' }}>
                        <div className="font-mono text-[9px] tracking-wide text-[#737373] uppercase">{s.short}</div>
                        <div className="font-mono text-[11px] tabular font-bold">{stageDeadlineLabel(c.peak_date!, s.weeksBeforePeak)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 포시즌 */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-4 pb-3" style={{ borderBottom: STRONG_BORDER }}>
            <h2 className="text-2xl font-bold tracking-[-0.01em]">포시즌 카테고리</h2>
            <span className="font-mono text-xs text-[#737373] tabular">{postseason.length}종</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {postseason.map((c) => (
              <div key={c.id} className="px-5 py-3" style={{ border: '2px dashed #A3A3A3' }}>
                <span className="font-bold text-base">{c.name}</span>
                <span className="font-mono text-[10px] text-[#737373] ml-2">{c.subtitle}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-[#737373] mt-3">포시즌은 정점이 없어 빈 슬롯에 자유 투입됩니다.</p>
        </section>

        <footer className="mt-24 pt-6 font-mono text-[10px] text-[#737373] tracking-[0.15em] uppercase flex justify-between tabular" style={{ borderTop: STRONG_BORDER }}>
          <span>HEAVY DUTY ARCHIVE · ADMIN</span>
          <span>정점 → 5단계 자동 계산</span>
        </footer>
      </div>
    </main>
  );
}

function AssigneesManager({ assignees, onChange }: { assignees: Assignee[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  async function submit() {
    const name = newName.trim();
    if (!name) { alert('이름을 입력하세요'); return; }
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '') || `a${Date.now()}`;
    try { await addAssignee(id, name); setNewName(''); setAdding(false); onChange(); }
    catch (e: any) { alert('추가 실패: ' + e.message); }
  }
  async function remove(id: string, name: string) {
    if (!confirm(`담당자 "${name}" 삭제?`)) return;
    try { await deleteAssignee(id); onChange(); } catch (e: any) { alert('삭제 실패: ' + e.message); }
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {assignees.map((a) => (
        <div key={a.id} className="flex items-center gap-2 px-4 py-2.5" style={{ background: '#000', color: '#FFF', border: '2px solid #000' }}>
          <span className="text-base font-bold">{a.name}</span>
          <button onClick={() => remove(a.id, a.name)} className="font-mono text-xs text-white/70 hover:text-white ml-1">✕</button>
        </div>
      ))}
      {adding ? (
        <div className="flex items-center gap-2">
          <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="이름" className="px-3 py-2 text-base font-bold bg-white" style={{ border: '2px solid #000', minWidth: 100 }} />
          <button onClick={submit} className="px-4 py-2 bg-black text-white font-mono text-xs tracking-widest uppercase hover:opacity-80">추가</button>
          <button onClick={() => { setAdding(false); setNewName(''); }} className="px-3 py-2 font-mono text-xs tracking-widest uppercase hover:bg-[#F5F5F5]" style={{ border: '2px solid #A3A3A3' }}>취소</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="px-4 py-2.5 font-mono text-xs tracking-widest uppercase hover:bg-black hover:text-white transition-colors" style={{ border: '2px solid #000' }}>+ 담당자 추가</button>
      )}
    </div>
  );
}
