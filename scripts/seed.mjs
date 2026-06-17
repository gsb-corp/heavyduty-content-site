// 카테고리 JSON → Supabase 마이그레이션
// 실행: node scripts/seed.mjs (프로젝트 루트에서)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env.local 직접 읽기
const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const data = JSON.parse(readFileSync('lib/data/categories.json', 'utf-8'));

console.log(`📦 마이그레이션 시작 — ${data.categories.length}개 카테고리`);
console.log('');

let totalCycles = 0;
let errors = 0;

for (let i = 0; i < data.categories.length; i++) {
  const cat = data.categories[i];

  // 1. 카테고리 upsert
  const { error: catErr } = await supabase.from('categories').upsert({
    id: cat.id,
    name: cat.name,
    subtitle: cat.subtitle,
    season: cat.season,
    reliability: cat.reliability,
    keywords: cat.keywords,
    sort_order: i,
  });

  if (catErr) {
    console.error(`✗ ${cat.id}:`, catErr.message);
    errors++;
    continue;
  }

  // 2. 기존 cycles 삭제 (재실행 시 중복 방지)
  await supabase.from('cycles').delete().eq('category_id', cat.id);

  // 3. cycles 삽입
  for (const cycle of cat.cycles) {
    const { error: cycErr } = await supabase.from('cycles').insert({
      category_id: cat.id,
      type: cycle.type,
      season: cycle.season,
      sourcing_week: cycle.sourcing_week,
      open_week: cycle.open_week,
      peak_week: cycle.peak_week,
      golden_weeks: cycle.golden_weeks,
      strength_pct: cycle.strength_pct,
      note: cycle.note || null,
    });
    if (cycErr) {
      console.error(`✗ ${cat.id}/${cycle.type}:`, cycErr.message);
      errors++;
    } else {
      totalCycles++;
    }
  }

  const subTag = cat.cycles.length > 1 ? ' [+sub]' : '';
  console.log(`✓ ${cat.id} (${cat.name})${subTag}`);
}

console.log('');
console.log(`📊 결과: 카테고리 ${data.categories.length}개 / 사이클 ${totalCycles}개 / 에러 ${errors}건`);
