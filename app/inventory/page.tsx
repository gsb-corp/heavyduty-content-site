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

// 카테고리 — 스키마엔 없어서 품번·제품명으로 추론. 규칙 순서가 곧 우선순위다.
// 2026-08-13 전수 점검으로 오분류 20점을 바로잡은 규칙. 순서를 바꾸면 다시 샌다.
const CATEGORY_ORDER = ['데님', '스웻', '니트', '플리스', '아우터', '셔츠', '바지',
  '모자', '스카프', '가방', '벨트', '기타'];

// ⚠ 'sweatshirt' 안에 'tshirt'가 들어있다(swea-tshirt) → 단어경계로 잡고 sweatshirt는 뺀다.
const TSHIRT = /\bt-?\s?shirts?\b|티셔츠/;
const SWEATSHIRT = /sweat\s?shirt/;
// ⚠ 데님은 브랜드가 아니라 품목으로 판정한다. 'levi'를 넣으면 리바이스 셔츠까지 하의로 끌려간다.
//    'jean' 단수는 Jean Paul Gaultier 같은 인명에 걸리므로 제외.
const DENIM = /\bjean\b(?!\s+paul)|\b(jeans|denim|501|505|550|559|517|560|orange tab|white tab|red tab)\b|청바지|데님/;
const DENIM_OUTER = /\b(jacket|trucker|chore|coat|vest|blazer|parka)\b|자켓|재킷|코트|조끼/;
const DENIM_TOP = /\bshirt\b|셔츠|남방/;         // "Nautica Jeans Co ... Shirt" 는 셔츠
const TIE = /\btie\b(?![\s-]*dye)|넥타이/;        // tie-dye 제외
// 후드 달린 바람막이는 스웻이 아니라 아우터. 'jacket'은 마스코트명(SCAD Yellow Jacket)에 쓰여 제외.
const SHELL = /anorak|windbreaker|windshirt|parka|gore-?tex|bomber|blouson|puffer|nano puff|field coat|바람막이|파카/;
const FLEECE_LINED = /fleece[- ]lined|lined fleece|pile[- ]lined/;  // 안감만 플리스 → 아우터

const CAT_KW: [string, string[]][] = [
  // 니트를 스웻보다 먼저 — "Quarter Zip Sweater"가 스웻으로 새지 않게.
  // ⚠ 'v-neck'은 목 모양일 뿐이니 넣지 말 것 ("RUSSELL V-Neck Sweatshirt"가 니트로 샌다).
  ['니트', ['sweater', 'cardigan', 'turtleneck', 'chunky wool', 'lambswool', 'shetland', 'aran', '니트', '스웨터', '가디건']],
  // 스웻 강신호 — 품목이 확정되는 말만. 약신호(pullover 등)는 셔츠 뒤로 뺀다.
  ['스웻', ['sweatshirt', 'sweat shirt', 'reverse weave', 'hoodie', '스웻', '스웨트', '맨투맨', '후드', '후디', '기모']],
  ['플리스', ['synchilla', 'snap-t', 'snap t', 'micro d', 'micro-d', 'microd', 'retro-x', 'retro x', 'konejo', 'los gatos', 'fleece', 'pile ', '신칠라', '스냅티', '플리스', '후리스', '마이크로디니']],
  // 모자·스카프·가방을 셔츠보다 먼저 — "Buffalo Check Trucker Cap"의 check, "Rugby Scarf"의 rugby 때문
  ['스카프', ['scarf', 'muffler', '스카프', '머플러']],
  ['모자', ['cap', 'hat', 'beanie', 'snapback', '모자', '캡', '비니', '볼캡']],
  ['가방', ['tote', 'bag', 'briefcase', 'backpack', 'messenger', 'pouch', '가방', '토트', '백팩', '파우치']],
  // ⚠ 'down' 단독 금지 — "Button-Down Shirt"가 다운자켓으로 잡힌다.
  ['아우터', ['jacket', 'vest', 'coat', 'parka', 'windbreaker', 'windshirt', 'bomber', 'goretex', 'gore-tex', 'anorak', 'field coat', 'puffer', 'nano puff', 'blazer', 'blouson', 'down jacket', 'down vest', 'goose down', '자켓', '재킷', '코트', '조끼', '베스트', '패딩', '점퍼', '바람막이', '코치']],
  // 바지를 셔츠보다 먼저 — "Polo Country ... 5 Pocket Pants"의 polo 때문
  ['바지', ['pants', 'shorts', 'trouser', 'chino', 'cargo', 'carpenter', 'slacks', '바지', '팬츠', '치노', '카고', '반바지', '슬랙스', '쇼츠']],
  ['셔츠', ['shirt', 'button down', 'button-down', 'flannel', 'ocbd', 'oxford', 'western', 'pearl snap', 'tattersall', 'windowpane', 'plaid', 'tartan', 'check', 'madras', 'polo', 'rugby', '셔츠', '남방']],
  ['스웻', ['crewneck', 'crew neck', 'pullover', 'quarter zip', '1/4 zip', 'hooded']],   // 약신호
  ['벨트', ['belt', '벨트']],
  ['기타', ['watch', 'necktie', 'cufflink', 'wallet', 'automatic day', 'daydate', '시계', '넥타이', '타이', '지갑']],
];
const BRAND_ONLY_CAT: [string, string][] = [['parajumpers', '아우터'], ['kodiak', '아우터'], ['gloverall', '아우터']];

function catFromText(raw: string): string | null {
  const s = (raw || '').toLowerCase();
  if (TSHIRT.test(s) && !SWEATSHIRT.test(s)) return '셔츠';
  if (TIE.test(s)) return '기타';
  if (SHELL.test(s)) return '아우터';
  if (DENIM.test(s)) {
    if (DENIM_OUTER.test(s)) return '아우터';
    if (DENIM_TOP.test(s.replace(SWEATSHIRT, '§'))) return '셔츠';
    return '데님';
  }
  const lined = s.replace(FLEECE_LINED, '§');
  for (const [cat, kws] of CAT_KW) {
    const src = cat === '플리스' ? lined : s;
    if (kws.some((k) => src.includes(k))) return cat;
  }
  for (const [kw, cat] of BRAND_ONLY_CAT) if (s.includes(kw)) return cat;
  return null;
}

function categoryOf(it: Item, batchLabel?: string): string {
  const c = it.code.toUpperCase();
  const name = `${it.name_en || ''} ${it.name_kr || ''}`;
  const n = name.toLowerCase();
  // 지퍼 달린 조끼형 스웨터는 조끼여도 본체가 스웨터 → 니트
  if (n.includes('sweater') && n.includes('vest')) return '니트';
  // HD 품번은 품목코드가 정답. 단 SW는 스웻/스웨터가 섞여 있어(HD2SW20=Sweatshirt,
  // HD4SW1=Sweater) 품번으로 못 가른다 → 이름으로 넘긴다.
  const hd = /^HD\d+([A-Z]+)\d+$/.exec(c);
  if (hd) {
    const byCode: Record<string, string> = { SH: '셔츠', JK: '아우터', BT: '바지', SWS: '스웻', DE: '데님', PS: '기타' };
    // JK 품번이어도 실제 물건이 플리스면 플리스 (HD2JK21 Retro Pile Fleece Jacket)
    if (hd[1] === 'JK' && catFromText(name) === '플리스') return '플리스';
    if (byCode[hd[1]]) return byCode[hd[1]];
  }
  // Patagonia 배치는 플리스가 기본이지만 나노퍼프(패딩) 예외가 섞여 있다
  if (/^TH3FC/.test(c)) return catFromText(name) || '플리스';
  if (/^TH2DE|^DB1DE/.test(c)) return '데님';
  if (/^TH1SW|^DT1SW|^DT1HD/.test(c)) return '스웻';
  if (/^LTD1/.test(c)) return '아우터';
  if (/^SP1SCV/.test(c)) return '스카프';
  if (/^BE1BC/.test(c)) return '모자';
  // 품번 접미사가 품목을 말해주는 경우 (PS_3_타이 · PS_11_스카프 · PS_6_VEST)
  const suffix = (it.code.match(/_/g) || []).length >= 2 ? it.code.split('_').slice(2).join('_') : '';
  return catFromText(name) || catFromText(suffix)
    || (batchLabel ? catFromText(batchLabel) : null) || '기타';
}

// 브랜드 — 긴 이름 먼저 매칭(폴로 서브라인이 'Ralph Lauren'에 먹히지 않도록)
const BRAND_RULES: [string, string][] = [
  ['double rl', 'RRL'], ['rrl', 'RRL'],
  ['polo country', 'Polo Country'], ['polo sport', 'Polo Sport'], ['polo golf', 'Polo Golf'],
  ['rlx', 'RLX'], ['polo ralph lauren', 'Polo Ralph Lauren'], ['ralph lauren', 'Polo Ralph Lauren'],
  ['l.l.bean', 'L.L.Bean'], ['l.l bean', 'L.L.Bean'], ['ll bean', 'L.L.Bean'], ['llbean', 'L.L.Bean'],
  ['eddie bauer', 'Eddie Bauer'], ['wrancher', 'Wrangler'], ['wrangler', 'Wrangler'],
  ['levi', "Levi's"], ['champion', 'Champion'], ['russell', 'Russell Athletic'],
  ['patagonia', 'Patagonia'], ['columbia', 'Columbia'], ['carhartt', 'Carhartt'],
  ['north face', 'The North Face'], ['nautica', 'Nautica'], ['pendleton', 'Pendleton'],
  ['big mac', 'Big Mac'], ['dickies', 'Dickies'], ['tommy', 'Tommy Hilfiger'],
  ['barbarian', 'Barbarian'], ['brooks brothers', 'Brooks Brothers'], ['woolrich', 'Woolrich'],
  ['harley', 'Harley-Davidson'], ['john deere', 'John Deere'], ['peter millar', 'Peter Millar'],
  ['old navy', 'Old Navy'], ['american eagle', 'American Eagle'], ['roper', 'Roper'],
  ['seiko', 'Seiko'], ['gap', 'GAP'], ['nike', 'Nike'], ['a.p.c', 'A.P.C.'],
  ['comme des', 'Comme des Garçons'], ['gloverall', 'Gloverall'], ['parajumpers', 'Parajumpers'],
  ['freitag', 'FREITAG'], ['paul smith', 'Paul Smith'], ['ferragamo', 'Ferragamo'],
  ['gaultier', 'Jean Paul Gaultier'], ['sierra', 'Sierra Designs'], ['mondetta', 'Mondetta'],
  ['5.11', '5.11 Tactical'], ['warehouse', 'Warehouse & Co.'], ['lacoste', 'Lacoste'],
  ['malbon', 'Malbon Golf'], ['flexfit', 'Flexfit'], ['u.s. navy', 'U.S. Navy'],
  ['universal products', 'Universal Products'], ['holloway', 'Holloway'],
  ['l.l. bean', 'L.L.Bean'], ['forty seve', 'Forty Seven'], ['a.j.m', 'A.J.M'],
  ['starter', 'Starter'], ['new era', 'New Era'], ['reebok', 'Reebok'], ['adidas', 'adidas'],
  ['puma', 'PUMA'], ['umbro', 'Umbro'], ['kappa', 'Kappa'], ['asahi', 'Asahi'],
  ['j.w.a', 'J.W.A'], ['looney tunes', 'Looney Tunes'], ['nautica jeans', 'Nautica'],
];
// 스카프·모자 로트는 의류 브랜드 축이 없다 → 이름 앞머리(구단명·캡 브랜드)를 브랜드로 쓴다.
//   "Chelsea Football Scarf" → Chelsea / "A.J.M 'ANACOLOR' Cap" → A.J.M
const LOT_TAIL = /\s+(football\s+scarf|rugby\s+scarf|scarf|trucker\s+cap|ball\s+cap|mesh\s+cap|snapback|cap|hat)\s*$/i;
function lotBrandOf(raw: string): string {
  let core = (raw || '').replace(/\s*\([A-Za-z]{2,6}\d*[A-Za-z]*_?\d+\)\s*$/, '').trim();
  if (!core || /^\d+$/.test(core)) return '';
  core = core.replace(LOT_TAIL, '').replace(/\s+(fc|afc)$/i, '').trim();
  core = core.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
  if (core.length < 2 || /^\d+$/.test(core)) return '';
  const m = /^([^"'“‘]+)["'“‘]/.exec(core);          // 인용부호 부제가 붙은 형태
  if (m && m[1].trim().length >= 2) core = m[1].trim();
  return core.split(/\s+/).slice(0, 4).join(' ');
}
function brandOf(it: Item): string {
  const raw = `${it.name_kr || ''} ${it.name_en || ''}`.trim();
  const n = raw.toLowerCase();
  for (const [kw, b] of BRAND_RULES) if (n.includes(kw)) return b;
  const c = it.code.toUpperCase();          // 이름이 비어도 묶음 자체가 단일 브랜드인 경우
  if (/^TH1SW/.test(c)) return 'Russell Athletic';
  if (/^DT1/.test(c)) return 'Champion';
  if (/^TH3FC/.test(c)) return 'Patagonia';
  if (/^TH2DE|^DB1DE/.test(c)) return "Levi's";
  if (/^LTD1/.test(c)) return 'Coach Jacket(로트)';
  if (/^SP1SCV|^BE1BC/.test(c)) return lotBrandOf(raw);
  return '';
}
// 상품명 앞머리의 (105) (34) 같은 사이즈 토큰
function sizeOf(it: Item): string {
  const m = /^\(([^)]{1,8})\)/.exec((it.name_kr || '').trim());
  return m ? m[1] : '';
}

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'batches' | 'flags'>('list');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'listed' | 'sold'>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');
  const [groupMode, setGroupMode] = useState<'category' | 'batch'>('category');
  const [selling, setSelling] = useState<Item | null>(null);
  const [sellPrice, setSellPrice] = useState('');
  const [sellDate, setSellDate] = useState('');
  const [noCostOnly, setNoCostOnly] = useState(false);      // 원가없는 판매만 보기 (노란 배너 클릭)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (id: string) => setCollapsed((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

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
    // 원가 연결된 판매만 마진 계산 (원가 없는 판매는 별도 집계)
    const soldWithCost = sold.filter((i) => i.unit_cost != null);
    const soldNoCost = sold.filter((i) => i.unit_cost == null);
    const revenue = sold.reduce((s, i) => s + (i.sold_price || 0), 0);            // 전체 매출 (원가 유무 무관)
    const revenueWC = soldWithCost.reduce((s, i) => s + (i.sold_price || 0), 0);   // 원가연결 판매 매출
    const soldCost = soldWithCost.reduce((s, i) => s + (i.unit_cost || 0), 0);     // 원가연결 판매 원가
    const revenueNC = soldNoCost.reduce((s, i) => s + (i.sold_price || 0), 0);     // 원가없는 판매 매출
    const stockCost = stock.reduce((s, i) => s + (i.unit_cost || 0), 0);
    const totalCost = batches.reduce((s, b) => s + (b.cost_total || 0), 0);
    return {
      stockN: stock.length, soldN: sold.length,
      revenue, stockCost, totalCost,
      marginN: soldWithCost.length, margin: revenueWC - soldCost, soldCost,
      noCostN: soldNoCost.length, revenueNC,
    };
  }, [items, batches]);

  const filtered = useMemo(() => {
    const qq = q.trim().toUpperCase();
    return items.filter((i) => {
      if (noCostOnly && !(i.status === 'sold' && i.unit_cost == null)) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (batchFilter && i.batch_id !== batchFilter) return false;
      if (qq && !(i.code.includes(qq) || (i.name_en || '').toUpperCase().includes(qq) || (i.name_kr || '').toUpperCase().includes(qq))) return false;
      return true;
    });
  }, [items, q, statusFilter, batchFilter, noCostOnly]);

  const flagged = useMemo(() => items.filter((i) => i.note), [items]);

  // 전 품목 CSV 내보내기 — 옵시디언 판매 분석용. 화면 필터와 무관하게 항상 전체를 담는다.
  function exportCSV() {
    const labelOf = (id: string | null) => batches.find((b) => b.id === id)?.label || (id ?? 'PS(개인소장)');
    const cols = ['품번', '브랜드', '카테고리', '사이즈', '상품명', '사입배치', '상태',
      '공급가', '판매가', '실판매가', '마진', '판매일', '사입단가USD', '주문번호'];
    const rows = [...items]
      .sort((a, b) => (b.sold_date || '').localeCompare(a.sold_date || '') || a.code.localeCompare(b.code))
      .map((i) => {
        const revenue = i.sold_price ?? 0;
        const margin = i.status === 'sold' && i.unit_cost != null && i.sold_price != null ? revenue - i.unit_cost : '';
        return [
          i.code, brandOf(i), categoryOf(i, labelOf(i.batch_id)), sizeOf(i),
          i.name_kr || i.name_en || '', labelOf(i.batch_id),
          STATUS_LABEL[i.status] || i.status,
          i.unit_cost ?? '', i.list_price ?? '', i.sold_price ?? '', margin,
          i.sold_date || '', i.usd ?? '', i.order_no || '',
        ];
      });
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
    const t = new Date();
    const stamp = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`;
    // BOM(U+FEFF)을 붙여야 엑셀에서 한글이 깨지지 않는다
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `헤비듀티_전품목_${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          {[
            { k: '재고', v: `${stats.stockN}점`, s: `원가 ${won(stats.stockCost)}원` },
            { k: '판매 (전체)', v: `${stats.soldN}점`, s: `매출 ${won(stats.revenue)}원` },
            { k: '판매 마진 (원가확인분)', v: `${won(stats.margin)}원`, s: `${stats.marginN}점 · 원가 ${won(stats.soldCost)}원` },
            { k: '총 사입원가', v: `${won(stats.totalCost)}원`, s: `회수율 ${stats.totalCost ? Math.round((stats.revenue / stats.totalCost) * 100) : 0}%` },
          ].map((c) => (
            <div key={c.k} className="p-4" style={{ border: STRONG_BORDER }}>
              <div className="font-mono text-[9px] tracking-[0.15em] uppercase text-[#737373] mb-1">{c.k}</div>
              <div className="text-xl font-bold tabular">{c.v}</div>
              <div className="font-mono text-[10px] text-[#737373] tabular mt-0.5">{c.s}</div>
            </div>
          ))}
        </div>

        {/* 원가 없는 판매 — 매출엔 잡히지만 원가 미연결이라 마진에서 제외 */}
        {stats.noCostN > 0 && (
          <button
            onClick={() => { const on = !noCostOnly; setNoCostOnly(on); setTab('list'); if (on) { setStatusFilter('all'); setBatchFilter(''); setQ(''); } }}
            className="w-full text-left mb-8 px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 hover:opacity-90 transition-opacity"
            style={{ border: noCostOnly ? '2px solid #B45309' : '2px solid #D4A017', background: noCostOnly ? '#FFF1D6' : '#FFFBF0' }}
          >
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase font-bold text-[#B45309]">⚠ 원가 없는 판매</span>
            <span className="text-sm"><b>{stats.noCostN}점</b> · 매출 <b>{won(stats.revenueNC)}원</b> — 판매는 확정, 원가 미연결이라 위 마진엔 미포함</span>
            <span className="font-mono text-[10px] text-[#B45309] font-bold ml-auto">{noCostOnly ? '✕ 전체 보기로' : '👉 이 51건만 보기'}</span>
          </button>
        )}

        {tab === 'list' && (() => {
          // 그룹핑 — 카테고리별(기본) 또는 사입배치별
          const groups: { id: string; label: string; items: Item[] }[] = [];
          if (groupMode === 'category') {
            const batchLabel = new Map(batches.map((b) => [b.id, b.label]));
            const byCat = new Map<string, Item[]>();
            for (const it of filtered) {
              const k = categoryOf(it, it.batch_id ? batchLabel.get(it.batch_id) : undefined);
              if (!byCat.has(k)) byCat.set(k, []);
              byCat.get(k)!.push(it);
            }
            for (const c of CATEGORY_ORDER) if (byCat.has(c)) groups.push({ id: c, label: c, items: byCat.get(c)! });
          } else {
            const byBatch = new Map<string, Item[]>();
            for (const it of filtered) {
              const k = it.batch_id || '__none__';
              if (!byBatch.has(k)) byBatch.set(k, []);
              byBatch.get(k)!.push(it);
            }
            for (const b of batches) if (byBatch.has(b.id)) groups.push({ id: b.id, label: b.label, items: byBatch.get(b.id)! });
            if (byBatch.has('__none__')) groups.push({ id: '__none__', label: '개별 · 배대지/수기 (원가 미연결 포함)', items: byBatch.get('__none__')! });
          }

          const ItemRow = (it: Item) => {
            const sc = STATUS_COLOR[it.status] || STATUS_COLOR.listed;
            const margin = it.status === 'sold' && it.sold_price != null && it.unit_cost != null ? it.sold_price - it.unit_cost : null;
            return (
              <tr key={it.id} style={{ borderBottom: '1px solid #EDEDED' }}>
                <td className="px-3 py-2 font-mono font-bold text-xs whitespace-nowrap">{it.code}{it.note && <span title={it.note}> ⚠️</span>}</td>
                <td className="px-2 py-2 hidden md:table-cell text-xs text-[#404040]">{it.name_kr || it.name_en || <span className="text-[#BBB]">—</span>}</td>
                <td className="px-2 py-2 text-right font-mono tabular text-xs">{won(it.unit_cost)}</td>
                <td className="px-2 py-2 text-right font-mono tabular text-xs hidden sm:table-cell">{won(it.list_price)}</td>
                <td className="px-2 py-2 text-right font-mono tabular text-xs font-bold">
                  {won(it.sold_price)}
                  {margin != null && <div className={`text-[9px] ${margin >= 0 ? 'text-[#1A7F37]' : 'text-[#C0392B]'}`}>{margin >= 0 ? '+' : ''}{won(margin)}</div>}
                </td>
                <td className="px-2 py-2 text-center font-mono tabular text-[11px] text-[#555] whitespace-nowrap hidden sm:table-cell">{it.sold_date ? it.sold_date.slice(2).replace(/-/g, '.') : '—'}</td>
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
          };

          return (
            <>
              <div className="flex flex-wrap gap-2 mb-4 items-center">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="품번·제품명 검색" className="px-3 py-2 text-sm font-mono flex-1 min-w-[160px]" style={{ border: STRONG_BORDER }} />
                {/* 그룹핑: 카테고리 / 배치 */}
                <div className="flex" style={{ border: STRONG_BORDER }}>
                  {([['category', '카테고리'], ['batch', '배치']] as const).map(([v, l], i) => (
                    <button key={v} onClick={() => setGroupMode(v)} className={`px-3 py-2 font-mono text-[10px] tracking-widest uppercase font-bold ${groupMode === v ? 'bg-black text-white' : 'bg-white'}`} style={{ borderLeft: i > 0 ? '2px solid #000' : 'none' }}>{l}</button>
                  ))}
                </div>
                <div className="flex" style={{ border: STRONG_BORDER }}>
                  {([['all', '전체'], ['listed', '재고'], ['sold', '판매']] as const).map(([v, l], i) => (
                    <button key={v} onClick={() => setStatusFilter(v)} className={`px-3 py-2 font-mono text-[10px] tracking-widest uppercase font-bold ${statusFilter === v ? 'bg-black text-white' : 'bg-white'}`} style={{ borderLeft: i > 0 ? '2px solid #000' : 'none' }}>{l}</button>
                  ))}
                </div>
                <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className="px-2 py-2 text-xs font-mono bg-white" style={{ border: STRONG_BORDER, maxWidth: 220 }}>
                  <option value="">모든 배치</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                <button onClick={exportCSV} title="전 품목을 브랜드·카테고리까지 붙여 CSV로 내려받습니다 (엑셀에서 바로 열림)"
                  className="px-3 py-2 font-mono text-[10px] tracking-widest uppercase font-bold bg-white hover:bg-black hover:text-white transition-colors"
                  style={{ border: STRONG_BORDER }}>
                  ↓ CSV
                </button>
                <span className="font-mono text-xs text-[#737373] tabular">{filtered.length}점</span>
                <button onClick={() => setCollapsed(collapsed.size ? new Set() : new Set(groups.map((g) => g.id)))} className="font-mono text-[10px] px-2 py-2 tracking-widest uppercase hover:bg-[#F5F5F5]" style={{ border: STRONG_BORDER }}>
                  {collapsed.size ? '모두 펼치기' : '모두 접기'}
                </button>
              </div>

              {noCostOnly && <p className="mb-3 text-xs font-mono text-[#B45309]">⚠ 원가 없는 판매 {filtered.length}건만 보는 중 — 노란 배너 다시 누르면 전체로</p>}

              {groups.map((g) => {
                const isCol = collapsed.has(g.id);
                const soldN = g.items.filter((i) => i.status === 'sold').length;
                const stockN = g.items.length - soldN;
                const sellPct = g.items.length ? Math.round((soldN / g.items.length) * 100) : 0;
                return (
                  <div key={g.id} className="mb-3" style={{ border: STRONG_BORDER }}>
                    <button onClick={() => toggleCollapse(g.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#EAEAEA]" style={{ background: '#F0F0F0', borderBottom: isCol ? 'none' : STRONG_BORDER }}>
                      <span className="font-bold text-sm shrink-0">{isCol ? '▸' : '▾'} {g.label}</span>
                      {/* 한눈에 현황 바 — 재고(검정) / 판매(초록) */}
                      <span className="hidden sm:flex flex-1 h-[10px] max-w-[220px] overflow-hidden" style={{ border: '1.5px solid #000' }} title={`재고 ${stockN} / 판매 ${soldN}`}>
                        <span style={{ width: `${100 - sellPct}%`, background: '#000' }} />
                        <span style={{ width: `${sellPct}%`, background: '#1A7F37' }} />
                      </span>
                      <span className="font-mono text-[11px] tabular ml-auto shrink-0">
                        <b className="text-black">재고 {stockN}</b>
                        <span className="text-[#737373]"> / 판매 {soldN}</span>
                        <span className="text-[#BBB]"> · {g.items.length}점</span>
                      </span>
                    </button>
                    {!isCol && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="font-mono text-[9px] tracking-[0.1em] uppercase text-[#737373]" style={{ borderBottom: '1.5px solid #A3A3A3', background: '#FAFAFA' }}>
                              <th className="text-left px-3 py-1.5">품번</th>
                              <th className="text-left px-2 py-1.5 hidden md:table-cell">제품명</th>
                              <th className="text-right px-2 py-1.5">원가</th>
                              <th className="text-right px-2 py-1.5 hidden sm:table-cell">책정가</th>
                              <th className="text-right px-2 py-1.5">실판매</th>
                              <th className="text-center px-2 py-1.5 hidden sm:table-cell">판매일</th>
                              <th className="text-center px-2 py-1.5">상태</th>
                              <th className="text-center px-2 py-1.5">처리</th>
                            </tr>
                          </thead>
                          <tbody>{g.items.map(ItemRow)}</tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {groups.length === 0 && <p className="p-6 text-center text-sm text-[#737373]">해당하는 아이템이 없습니다.</p>}
            </>
          );
        })()}

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
