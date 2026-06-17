// FW 2025 발행 일정 + 청자켓 카테고리 추가
// 실행: node scripts/seed-fw-2025.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('FW 2025 발행 일정 · 청자켓 신규 추가');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 1. 청자켓 카테고리 추가 (우리 v13 데이터 기반)
console.log('\n[1] 청자켓 · 데님자켓 카테고리 추가');
{
  const { error } = await supabase.from('categories').upsert({
    id: 'denim-jacket',
    name: '청자켓 · 데님자켓',
    subtitle: 'DENIM JACKET',
    season: '봄',
    reliability: 3,
    keywords: [
      { name: '청자켓', share: 60 },
      { name: '데님자켓', share: 40 }
    ],
    sort_order: 7,
    note: '데이터랩 16번 분석 — 봄 메인 + 가을 서브'
  });
  if (error) { console.error('✗', error.message); process.exit(1); }
  console.log('  ✓ category upsert');
}

// 청자켓 사이클 (재실행 가능하게 delete 후 insert)
{
  await supabase.from('cycles').delete().eq('category_id', 'denim-jacket');
  const { error } = await supabase.from('cycles').insert([
    {
      category_id: 'denim-jacket',
      type: 'main', season: '봄',
      sourcing_week: '1월 2주차', open_week: '2월 4주차', peak_week: '3월 2주차',
      golden_weeks: 4, strength_pct: 100,
      note: '봄 정점 3/20~3/27 (값 62.4) · 메인 시즌'
    },
    {
      category_id: 'denim-jacket',
      type: 'sub', season: '가을',
      sourcing_week: '8월 2주차', open_week: '9월 3주차', peak_week: '10월 1주차',
      golden_weeks: 4, strength_pct: 69,
      note: '가을 정점 10/7 (값 43.1, 봄 대비 69%)'
    }
  ]);
  if (error) { console.error('✗', error.message); process.exit(1); }
  console.log('  ✓ cycles inserted (봄 메인 + 가을 서브)');
}

// 2. FW 발행 진행 항목 — 5개 카테고리 × 5콘텐츠
const schedules = [
  {
    cat_id: 'denim-jacket', cat_name: '청자켓',
    items: [
      { date: '8/24', day: '월', type: '제품 업데이트', ref: null },
      { date: '8/25', day: '화', type: '제품 콘텐츠', ref: 'instagram.com/p/DW6GF_vlIt4' },
      { date: '8/26', day: '수', type: '정보성 콘텐츠', ref: 'instagram.com/p/DVJV25CARHD' },
      { date: '8/28', day: '금', type: 'OOTD 카드뉴스', ref: 'instagram.com/p/DYlTNnElDqG' },
      { date: '8/30', day: '일', type: 'OOTD 릴스', ref: 'instagram.com/p/DYZrizNRHQj / DXWtY1XAWot' }
    ]
  },
  {
    cat_id: 'anorak-coach', cat_name: '바람막이+아노락',
    items: [
      { date: '8/31', day: '월', type: '제품 업데이트', ref: null },
      { date: '9/1', day: '화', type: '제품 콘텐츠', ref: 'instagram.com/p/DVJV25CARHD' },
      { date: '9/2', day: '수', type: '정보성 콘텐츠', ref: 'DYJwipXEatd → "빈티지로 사야 하는 바람막이+아노락 브랜드"' },
      { date: '9/4', day: '금', type: 'OOTD 카드뉴스', ref: 'instagram.com/p/DYlTNnElDqG' },
      { date: '9/6', day: '일', type: 'OOTD 릴스', ref: 'instagram.com/p/DYZrizNRHQj / DXWtY1XAWot' }
    ]
  },
  {
    cat_id: 'fleece', cat_name: '플리스',
    items: [
      { date: '9/7', day: '월', type: '제품 업데이트', ref: '⚠ 마운틴파카 배제 → 플리스가 이 자리' },
      { date: '9/8', day: '화', type: '제품 콘텐츠', ref: null },
      { date: '9/9', day: '수', type: '정보성 콘텐츠', ref: '"플리스 원조는 파타고니아가 아니다" — 헬리한센 1961' },
      { date: '9/11', day: '금', type: 'OOTD 카드뉴스', ref: null },
      { date: '9/13', day: '일', type: 'OOTD 릴스', ref: null }
    ]
  },
  {
    cat_id: 'vest-jumper', cat_name: '패딩조끼',
    items: [
      { date: '9/14', day: '월', type: '제품 업데이트', ref: null },
      { date: '9/15', day: '화', type: '제품 콘텐츠', ref: null },
      { date: '9/16', day: '수', type: '정보성 콘텐츠', ref: null },
      { date: '9/18', day: '금', type: 'OOTD 카드뉴스', ref: null },
      { date: '9/20', day: '일', type: 'OOTD 릴스', ref: null }
    ]
  },
  {
    cat_id: 'padding', cat_name: '패딩',
    items: [
      { date: '9/21', day: '월', type: '제품 업데이트', ref: null },
      { date: '9/22', day: '화', type: '제품 콘텐츠', ref: null },
      { date: '9/23', day: '수', type: '정보성 콘텐츠', ref: null },
      { date: '9/25', day: '금', type: 'OOTD 카드뉴스', ref: null },
      { date: '9/27', day: '일', type: 'OOTD 릴스', ref: null }
    ]
  }
];

console.log('\n[2] FW 발행 진행 항목 입력');
for (const sched of schedules) {
  await supabase.from('progress_items').delete().eq('category_id', sched.cat_id);
  for (let i = 0; i < sched.items.length; i++) {
    const it = sched.items[i];
    const { error } = await supabase.from('progress_items').insert({
      category_id: sched.cat_id,
      label: `${it.date} (${it.day}) — ${it.type}`,
      notes: it.ref,
      status: 'todo',
      sort_order: i
    });
    if (error) { console.error('  ✗', sched.cat_id, error.message); }
  }
  console.log(`  ✓ ${sched.cat_name.padEnd(15)} ${sched.items.length}개`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('완료. 사이트 새로고침해서 확인하세요.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
