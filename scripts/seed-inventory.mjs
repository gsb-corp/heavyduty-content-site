// 재고 데이터 시드 — 사용법: node scripts/seed-inventory.mjs <seed_data.json 경로>
// 데이터 파일은 레포 밖에 둡니다 (원가 정보 — 공개 레포에 커밋 금지)
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
const env = Object.fromEntries(envFile.split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const dataPath = process.argv[2];
if (!dataPath) { console.error('사용법: node scripts/seed-inventory.mjs <seed_data.json>'); process.exit(1); }
const { batches, items } = JSON.parse(readFileSync(dataPath, 'utf8'));

const clean = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === undefined ? null : v]));

async function main() {
  console.log(`배치 ${batches.length} · 아이템 ${items.length} 시드 시작`);

  // 기존 데이터 삭제 (재실행 안전)
  await supabase.from('hd_items').delete().neq('code', '');
  await supabase.from('hd_batches').delete().neq('id', '');

  const { error: be } = await supabase.from('hd_batches').insert(batches.map(clean));
  if (be) { console.error('배치 실패:', be.message); process.exit(1); }
  console.log('배치 OK');

  const rows = items.map((it) => clean({
    code: it.code, batch_id: it.batch_code || null,
    name_en: it.name_en, name_kr: it.name_kr,
    usd: it.usd, unit_cost: it.unit_cost, cost_alloc: it.cost_alloc,
    list_price: it.list_price != null ? Math.round(it.list_price) : null,
    sold_price: it.sold_price != null ? Math.round(it.sold_price) : null,
    status: it.status, arrived_date: it.arrived_date || null, sold_date: it.sold_date || null,
    order_no: it.order_no, source: it.source, note: it.note,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase.from('hd_items').insert(rows.slice(i, i + 100));
    if (error) { console.error(`아이템 ${i}~ 실패:`, error.message); process.exit(1); }
    console.log(`아이템 ${Math.min(i + 100, rows.length)}/${rows.length}`);
  }
  console.log('시드 완료 ✓');
}
main();
