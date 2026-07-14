'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const STRONG_BORDER = '2px solid #000';

interface Batch {
  id: string; label: string; source: string;
  cost_product: number | null; cost_vat: number | null; cost_duty: number | null;
  cost_ship_intl: number | null; cost_ship_dom: number | null; cost_etc: number | null;
  cost_total: number | null; qty_declared: number | null; qty_loss: number | null;
}
interface Item {
  id: string; code: string; batch_id: string | null;
  name_en: string | null; name_kr: string | null;
  usd: number | null; unit_cost: number | null; cost_alloc: string | null;
  list_price: number | null; sold_price: number | null;
  status: string; arrived_date: string | null; sold_date: string | null;
  order_no: string | null; source: string | null; note: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  ordered: '주문', shipping: '배송중', arrived: '입고', care: '케어',
  listed: '재고', sold: '판매', loss: '로스',
};
const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  listed: { bg: '#FFF', fg: '#000' }, sold: { bg: '#1A7F37', fg: '#FFF' },
  loss: { bg: '#C0392B', fg: '#FFF' }, care: { bg: '#FFC400', fg: '#000' },
  arrived: { bg: '#E8F3EC', fg: '#000' }, shipping: { bg: '#FFF4E0', fg: '#000' }, ordered: { bg: '#EEE', fg: '#000' },
};
const won = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('ko-KR'));

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'batches' | 'flags'>('list');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'listed' | 'sold'>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [selling, setSelling] = useState<Item | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState('');

  async function loadAll() {
    setLoading(true);
    const [ir, br] = await Promise.all([
      supabase.from('hd_items').select('*').order('code'),
      supabase.from('hd_batches').select('*').order('id'),
    ]);
    if (ir.error) setError(ir.error.message);
    else { setItems((ir.data || []) as Item[]); setBatches((br.data || []) as Batch[]); }
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  const stats = useMemo(() => {
    const stock = items.filter((i) => i.status === 'listed');
    const sold = items.filter((i) => i.status === 'sold');
    const revenue = sold.reduce((s, i) => s + (i.sold_price || 0), 0);
    const soldCost = sold.reduce((s, i) => s + (i.unit_cost || 0), 0);
    const stockCost = stock.reduce((s, i) => s + (i.unit_cost || 0), 0);
    const totalCost = batches.reduce((s, b) => s + (b.cost_total || 0), 0);
    return { stockN: stock.length, soldN: sold.length, revenue, soldCost, stockCost, totalCost, margin: revenue - soldCost };
  }, [items, batches]);

  const filtered = useMemo(() => {
    const qq = q.trim().toUpperCase();
    return items.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (batchFilter && i.batch_id !== batchFilter) return false;
      if (qq && !(i.code.includes(qq) || (i.name_en || '').toUpperCase().includes(qq) || (i.name_kr || '').toUpperCase().includes(qq))) return false;
      return true;
    });
  }, [items, q, statusFilter, batchFilter]);

  const flagged = useMemo(() => items.filter((i) => i.note), [items]);

  function openSell(it: Item) {
    setSelling(it);
    setSellPrice(String(it.list_price ?? ''));
    const t = new Date();
    setSellDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
  }
  async function confirmSell() {
    if (!selling) return;
    const price = parseInt(sellPrice.replace(/[^0-9]/g, ''), 10);
    if (!price) { alert('판매가를 입력하세요'); return; }
    const patch = { status: 'sold', sold_price: price, sold_date: sellDate || null };
    setItems((prev) => prev.map((i) => (i.id === selling.id ? { ...i, ...patch } as Item : i)));
    setSelling(null);
    const { error: e } = await supabase.from('hd_items').update(patch).eq('id', selling.id);
    if (e) { alert('저장 실패: ' + e.message); loadAll(); }
  }
  async function undoSell(it: Item) {
    if (!confirm(`${it.code} 판매 취소하고 재고로 되돌릴까요?`)) return;
    const patch = { status: 'listed', sold_price: null, sold_date: null };
    setItems((prev) => prev.map((i) => (i.id === it.id ? { ...i, ...patch } as Item : i)));
    const { error: e } = await supabase.from('hd_items').update(patch).eq('id', it.id);
    if (e) { alert('저장 실패: ' + e.message); loadAll(); }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-white"><p className="text-[#737373] font-mono text-xs tracking-[0.15em] uppercase">LOADING…</p></div>;
  if (error) return <div className="flex items-center justify-center min-h-screen bg-white px-6"><div className="text-center max-w-md p-8" style={{ border: STRONG_BORDER }}><div className="font-mono text-xs tracking-[0.2em] uppercase text-[#737373] mb-3">ERROR</div><p className="text-sm">{error}</p><p className="text-xs text-[#737373] mt-3">hd_items 테이블이 없다면 migration_inventory.sql을 먼저 실행하세요.</p></div></div>;

  return (
    <main className="bg-white text-black min-h-screen">
      <div className="mx-auto px-4 md:px-10 py-10" style={{ maxWidth: 1280 }}>
        <div className="mb-6 flex justify-between items-center">
          <Link href="/" className="font-mono text-xs tracking-[0.15em] uppercase hover:underline">← 운영 시간표</Link>
        </div>
        <header className="pb-5 mb-6 flex flex-wrap items-end justify-between gap-4" style={{ borderBottom: STRONG_BORDER }}>
          <div>
            <div className="font-mono text-[11px] tracking-[0.2em] text-[#737373] uppercase mb-2 font-medium">Heavy Duty · Inventory</div>
            <h1 className="text-[34px] font-bold tracking-[-0.025em] leading-[1.0]">재고 · 원가</h1>
          </div>
          <div className="flex gap-2">
            {(['list', 'batches', 'flags'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase font-bold ${tab === t ? 'bg-black text-white' : 'bg-white text-black'}`} style={{ border: STRONG_BORDER }}>
                {t === 'list' ? '📦 재고목록' : t === 'batches' ? '🚚 사입배치' : `⚠️ 확인필요 ${flagged.length}`}
              </button>
            ))}
          </div>
        </header>

        {/* 손익 요약 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { k: '재고', v: `${stats.stockN}점`, s: `원가 ${won(stats.stockCost)}원` },
            { k: '판매', v: `${stats.soldN}점`, s: `매출 ${won(stats.revenue)}원` },
            { k: '판매 마진', v: `${won(stats.margin)}원`, s: `판매분 원가 ${won(stats.soldCost)}원` },
            { k: '총 사입원가', v: `${won(stats.totalCost)}원`, s: `회수율 ${stats.totalCost ? Math.round((stats.revenue / stats.totalCost) * 100) : 0}%` },
          ].map((c) => (
            <div key={c.k} className="p-4" style={{ border: STRONG_BORDER }}>
              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#737373] mb-1">{c.k}</div>
              <div className="text-xl font-bold tabular">{c.v}</div>
              <div className="font-mono text-[10px] text-[#737373] tabular mt-0.5">{c.s}</div>
            </div>
          ))}
        </div>

        {tab === 'list' && (
          <>
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="품번·제품명 검색" className="px-3 py-2 text-sm font-mono flex-1 min-w-[180px]" style={{ border: STRONG_BORDER }} />
              <div className="flex" style={{ border: STRONG_BORDER }}>
                {([['all', '전체'], ['listed', '재고'], ['sold', '판매']] as const).map(([v, l], i) => (
                  <button key={v} onClick={() => setStatusFilter(v)} className={`px-3 py-2 font-mono text-[10px] tracking-widest uppercase font-bold ${statusFilter === v ? 'bg-black text-white' : 'bg-white'}`} style={{ borderLeft: i > 0 ? '2px solid #000' : 'none' }}>{l}</button>
                ))}
              </div>
              <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className="px-2 py-2 text-xs font-mono bg-white" style={{ border: STRONG_BORDER, maxWidth: 220 }}>
                <option value="">모든 배치</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
              <span className="font-mono text-xs text-[#737373] tabular">{filtered.length}점</span>
            </div>
            <div className="overflow-x-auto" style={{ border: STRONG_BORDER }}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="font-mono text-[9px] tracking-[0.1em] uppercase text-[#737373]" style={{ borderBottom: STRONG_BORDER, background: '#F5F5F5' }}>
                    <th className="text-left px-3 py-2">품번</th>
                    <th className="text-left px-2 py-2 hidden md:table-cell">제품명</th>
                    <th className="text-right px-2 py-2">원가</th>
                    <th className="text-right px-2 py-2 hidden sm:table-cell">책정가</th>
                    <th className="text-right px-2 py-2">실판매</th>
                    <th className="text-center px-2 py-2">상태</th>
                    <th className="text-center px-2 py-2">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 400).map((it) => {
                    const sc = STATUS_COLOR[it.status] || STATUS_COLOR.listed;
                    const margin = it.status === 'sold' && it.sold_price != null && it.unit_cost != null ? it.sold_price - it.unit_cost : null;
                    return (
                      <tr key={it.id} style={{ borderBottom: '1px solid #E5E5E5' }}>
                        <td className="px-3 py-2 font-mono font-bold text-xs whitespace-nowrap">{it.code}{it.note && <span title={it.note}> ⚠️</span>}</td>
                        <td className="px-2 py-2 hidden md:table-cell text-xs text-[#404040]">{it.name_kr || it.name_en || <span className="text-[#BBB]">—</span>}</td>
                        <td className="px-2 py-2 text-right font-mono tabular text-xs">{won(it.unit_cost)}</td>
                        <td className="px-2 py-2 text-right font-mono tabular text-xs hidden sm:table-cell">{won(it.list_price)}</td>
                        <td className="px-2 py-2 text-right font-mono tabular text-xs font-bold">
                          {won(it.sold_price)}
                          {margin != null && <div className={`text-[9px] ${margin >= 0 ? 'text-[#1A7F37]' : 'text-[#C0392B]'}`}>{margin >= 0 ? '+' : ''}{won(margin)}</div>}
                        </td>
                        <td className="px-2 py-2 text-center"><span className="font-mono text-[9px] px-1.5 py-0.5 font-bold" style={{ background: sc.bg, color: sc.fg, border: '1px solid #000' }}>{STATUS_LABEL[it.status] || it.status}</span></td>
                        <td className="px-2 py-2 text-center whitespace-nowrap">
                          {it.status === 'listed'
                            ? <button onClick={() => openSell(it)} className="font-mono text-[10px] px-2 py-1 font-bold bg-black text-white hover:opacity-75">판매</button>
                            : it.status === 'sold'
                            ? <button onClick={() => undoSell(it)} className="font-mono text-[10px] px-2 py-1 hover:bg-[#F5F5F5]" style={{ border: '1.5px solid #A3A3A3' }}>취소</button>
                            : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length > 400 && <p className="p-3 text-xs text-[#737373] font-mono">…{filtered.length - 400}점 더 있음 — 검색·필터로 좁혀보세요</p>}
            </div>
          </>
        )}

        {tab === 'batches' && (
          <div className="overflow-x-auto" style={{ border: STRONG_BORDER }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="font-mono text-[9px] tracking-[0.1em] uppercase text-[#737373]" style={{ borderBottom: STRONG_BORDER, background: '#F5F5F5' }}>
                  <th className="text-left px-3 py-2">배치</th>
                  <th className="text-right px-2 py-2">아이템</th>
                  <th className="text-right px-2 py-2 hidden md:table-cell">사입가</th>
                  <th className="text-right px-2 py-2 hidden md:table-cell">관·부가세</th>
                  <th className="text-right px-2 py-2 hidden md:table-cell">배송비</th>
                  <th className="text-right px-2 py-2">총 원가</th>
                  <th className="text-right px-2 py-2">판매/재고</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const bi = items.filter((i) => i.batch_id === b.id);
                  const soldN = bi.filter((i) => i.status === 'sold').length;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #E5E5E5' }}>
                      <td className="px-3 py-2 text-xs font-bold">{b.label}<div className="font-mono text-[9px] text-[#737373]">{b.source}</div></td>
                      <td className="px-2 py-2 text-right font-mono tabular text-xs">{bi.length}점</td>
                      <td className="px-2 py-2 text-right font-mono tabular text-xs hidden md:table-cell">{won(b.cost_product)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular text-xs hidden md:table-cell">{won((b.cost_vat || 0) + (b.cost_duty || 0))}</td>
                      <td className="px-2 py-2 text-right font-mono tabular text-xs hidden md:table-cell">{won((b.cost_ship_intl || 0) + (b.cost_ship_dom || 0))}</td>
                      <td className="px-2 py-2 text-right font-mono tabular text-xs font-bold">{won(b.cost_total)}</td>
                      <td className="px-2 py-2 text-right font-mono tabular text-xs">{soldN} / {bi.length - soldN}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'flags' && (
          <div className="space-y-2">
            <p className="text-xs text-[#737373] mb-3">이관 중 발견된 확인 필요 항목 — 품번 중복·원가 미연결 등. 확인 후 이 화면에서 판매처리하거나, 관리자가 DB에서 정리하면 됩니다.</p>
            {flagged.map((it) => (
              <div key={it.id} className="p-3 flex flex-wrap gap-3 items-center" style={{ border: '2px solid #D4A017', background: '#FFFBF0' }}>
                <span className="font-mono font-bold text-xs">{it.code}</span>
                <span className="text-xs flex-1">{it.note}</span>
                <span className="font-mono text-[10px] tabular">책정 {won(it.list_price)} · 실판매 {won(it.sold_price)}</span>
              </div>
            ))}
            {flagged.length === 0 && <p className="text-sm text-[#737373]">확인 필요 항목이 없습니다 🎉</p>}
          </div>
        )}

        <footer className="mt-16 pt-6 font-mono text-[10px] text-[#737373] tracking-[0.15em] uppercase flex justify-between tabular" style={{ borderTop: STRONG_BORDER }}>
          <span>HEAVY DUTY ARCHIVE · INVENTORY</span>
          <span>{items.length} ITEMS · {batches.length} BATCHES</span>
        </footer>
      </div>

      {/* 판매 처리 모달 */}
      {selling && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelling(null)} />
          <div className="fixed z-50 bg-white p-5 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[360px]" style={{ border: STRONG_BORDER, boxShadow: '0 8px 30px rgba(0,0,0,0.25)' }}>
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-[#737373] mb-1">판매 처리</div>
            <div className="font-bold text-lg mb-1">{selling.code}</div>
            <div className="text-xs text-[#555] mb-4">{selling.name_kr || selling.name_en} · 책정가 {won(selling.list_price)}원 · 원가 {won(selling.unit_cost)}원</div>
            <label className="font-mono text-[10px] uppercase text-[#737373]">실판매가 (원)</label>
            <input autoFocus value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmSell()} inputMode="numeric" className="w-full px-3 py-2.5 text-lg font-mono tabular font-bold mb-3 mt-1" style={{ border: STRONG_BORDER }} />
            <label className="font-mono text-[10px] uppercase text-[#737373]">판매일</label>
            <input type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} className="w-full px-3 py-2 text-sm font-mono mb-4 mt-1" style={{ border: '2px solid #A3A3A3' }} />
            <div className="flex gap-2">
              <button onClick={confirmSell} className="flex-1 py-2.5 bg-black text-white font-mono text-xs tracking-widest uppercase font-bold hover:opacity-80">판매 확정</button>
              <button onClick={() => setSelling(null)} className="px-4 py-2.5 font-mono text-xs tracking-widest uppercase hover:bg-[#F5F5F5]" style={{ border: '2px solid #A3A3A3' }}>취소</button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
