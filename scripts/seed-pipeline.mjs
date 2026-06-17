// 파이프라인 모델 시드 — 12개 카테고리 정리 + 정점 날짜 + 5단계 생성
// 실행: node scripts/seed-pipeline.mjs

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
console.log('파이프라인 시드 — 회의 확정 12개 카테고리');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 회의 확정: 시즌 메인 9 + 포시즌 3 = 12개
// id, name, subtitle, season, peak_date(YYYY-MM-DD or null), track, sort_order
const CATEGORIES = [
  // ── 시즌 메인 9개 (정점 날짜 있음) ──
  { id: 'work-shirt',     name: '플란넬·체크셔츠',   subtitle: 'FLANNEL · CHECK', season: '가을', peak_date: '2026-09-03', track: 'season', sort: 1 },
  { id: 'mountain-parka', name: '마운틴파카 (60/40)', subtitle: 'MOUNTAIN PARKA',  season: '가을', peak_date: '2026-09-28', track: 'season', sort: 2 },
  { id: 'anorak-coach',   name: '바람막이+아노락',   subtitle: 'ANORAK · COACH',  season: '가을', peak_date: '2026-10-01', track: 'season', sort: 3 },
  { id: 'denim-jacket',   name: '청자켓·데님자켓',   subtitle: 'DENIM JACKET',    season: '가을', peak_date: '2026-10-07', track: 'season', sort: 4 },
  { id: 'hunting-jacket', name: '필드·헌팅자켓',     subtitle: 'FIELD · HUNTING', season: '가을', peak_date: '2026-11-02', track: 'season', sort: 5 },
  { id: 'sweatshirt',     name: '맨투맨·후드티',     subtitle: 'SWEAT · HOODIE',  season: '가을', peak_date: '2026-10-26', track: 'season', sort: 6 },
  { id: 'fleece',         name: '플리스',            subtitle: 'FLEECE JACKET',   season: '가을', peak_date: '2026-11-09', track: 'season', sort: 7 },
  { id: 'vest-jumper',    name: '패딩조끼',          subtitle: 'PADDED VEST',     season: '겨울', peak_date: '2026-11-16', track: 'season', sort: 8 },
  { id: 'padding',        name: '패딩·다운파카',     subtitle: 'DOWN · PADDING',  season: '겨울', peak_date: '2026-12-01', track: 'season', sort: 9 },
  // ── 포시즌 3개 (정점 없음, 빈 슬롯 투입) ──
  { id: 'denim',          name: '청바지 (데님)',     subtitle: "LEVI'S · DENIM",  season: '봄',   peak_date: null, track: 'postseason', sort: 10 },
  { id: 'cap',            name: '모자',              subtitle: 'VINTAGE CAP',     season: '봄',   peak_date: null, track: 'postseason', sort: 11 },
  { id: 'polo',           name: '폴로 (4시즌)',      subtitle: 'POLO · 4SEASON',  season: '봄',   peak_date: null, track: 'postseason', sort: 12 },
];

// 5단계 정의 (트랙: ops=운영, content=콘텐츠)
// 기본 담당: 운영 = 윤빈(yoonbin), 콘텐츠 = 미배정(null, 콘텐츠팀이 나눠가짐)
const STAGES = [
  { type: 'order',    role: 'ops',     default_assignee: 'yoonbin' },
  { type: 'shipping', role: 'ops',     default_assignee: 'yoonbin' },
  { type: 'care',     role: 'ops',     default_assignee: 'yoonbin' },
  { type: 'creative', role: 'content', default_assignee: null },
  { type: 'publish',  role: 'content', default_assignee: null },
];

const ACTIVE_IDS = CATEGORIES.map((c) => c.id);

// 1. 회의 확정 외 카테고리 비활성화 (heavy-sweater, corduroy, shell-parka, chino-cargo, tshirt, shorts 등)
console.log('\n[1] 회의 확정 외 카테고리 비활성화');
{
  const { data: all } = await supabase.from('categories').select('id, name, active');
  for (const c of all || []) {
    if (!ACTIVE_IDS.includes(c.id) && c.active !== false) {
      await supabase.from('categories').update({ active: false }).eq('id', c.id);
      console.log(`  − ${c.id} (${c.name}) 비활성화`);
    }
  }
}

// 2. 12개 카테고리 upsert (정점 날짜·트랙·active=true)
console.log('\n[2] 12개 카테고리 upsert (정점 날짜 + 트랙)');
for (const c of CATEGORIES) {
  const { error } = await supabase.from('categories').upsert({
    id: c.id,
    name: c.name,
    subtitle: c.subtitle,
    season: c.season,
    reliability: 3,
    peak_date: c.peak_date,
    track: c.track,
    active: true,
    sort_order: c.sort,
  });
  if (error) { console.error(`  ✗ ${c.id}:`, error.message); continue; }
  const peakLabel = c.peak_date ? `정점 ${c.peak_date}` : '포시즌 (정점 없음)';
  console.log(`  ✓ ${c.name.padEnd(16)} ${peakLabel}`);
}

// 3. 시즌 카테고리에 5단계 생성 (포시즌은 단계 없음 — 빈 슬롯 투입이라 파이프라인 불필요)
console.log('\n[3] 시즌 카테고리 5단계 생성');
let stageCount = 0;
for (const c of CATEGORIES) {
  if (c.track !== 'season') continue;
  // 기존 단계 삭제 후 재생성 (재실행 가능)
  await supabase.from('category_stages').delete().eq('category_id', c.id);
  for (const s of STAGES) {
    const { error } = await supabase.from('category_stages').insert({
      category_id: c.id,
      stage_type: s.type,
      status: 'todo',
      assignee_id: s.default_assignee,
    });
    if (error) { console.error(`  ✗ ${c.id}/${s.type}:`, error.message); }
    else stageCount++;
  }
  console.log(`  ✓ ${c.name.padEnd(16)} 5단계 생성`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`완료 — 카테고리 12개 (시즌 9 + 포시즌 3) / 단계 ${stageCount}개`);
console.log('  운영 단계(발주·배송·케어) → 윤빈 기본 배정');
console.log('  콘텐츠 단계(기획·제작·발행) → 미배정 (콘텐츠팀)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
