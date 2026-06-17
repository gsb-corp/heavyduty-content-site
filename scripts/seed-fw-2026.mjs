// FW 2026 발행 일정 — v2 통합본 (모자 제외, 1주 앞당김, 플란넬 포함)
// 실행: node scripts/seed-fw-2026.mjs

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
console.log('FW 2026 발행 일정 시드 (12개 카테고리 × 6콘텐츠)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// 12개 카테고리 캘린더 (cat_id는 categories.json 기준 slug)
const CALENDAR = [
  { cat_id: 'work-shirt',     cat_name: '플란넬·체크셔츠',     start: '2026-08-17' },
  { cat_id: 'denim-jacket',   cat_name: '청자켓·데님자켓',     start: '2026-08-24' },
  { cat_id: 'denim',          cat_name: '청바지',              start: '2026-08-31' },
  { cat_id: 'anorak-coach',   cat_name: '바람막이+아노락',     start: '2026-09-07' },
  { cat_id: 'fleece',         cat_name: '플리스',              start: '2026-09-14' },
  { cat_id: 'vest-jumper',    cat_name: '패딩조끼',            start: '2026-09-21' },
  { cat_id: 'mountain-parka', cat_name: '마운틴파카',          start: '2026-09-28' },
  { cat_id: 'padding',        cat_name: '패딩',                start: '2026-10-05' },
  { cat_id: 'sweatshirt',     cat_name: '맨투맨·후드티',       start: '2026-10-12' },
  { cat_id: 'hunting-jacket', cat_name: '필드·헌팅자켓',       start: '2026-10-19' },
  { cat_id: 'heavy-sweater',  cat_name: '코위찬·헤비스웨터',   start: '2026-11-02' },
  { cat_id: 'corduroy',       cat_name: '코듀로이',            start: '2026-12-07' },
];

// 6콘텐츠 패턴 (요일 오프셋, 문화 콘텐츠 NEW)
const CONTENT_PATTERN = [
  { offset: 0, day: '월', type: '제품 업데이트' },
  { offset: 1, day: '화', type: '제품 콘텐츠' },
  { offset: 2, day: '수', type: '정보성 콘텐츠' },
  { offset: 3, day: '목', type: '문화 콘텐츠' },
  { offset: 4, day: '금', type: 'OOTD 카드뉴스' },
  { offset: 6, day: '일', type: 'OOTD 릴스' },
];

// 카테고리별 콘텐츠 메모 (ref·앵글)
const REFS = {
  '플란넬·체크셔츠': {
    '정보성 콘텐츠': '플란넬 헤리티지 — 필슨·펜들턴·울리치·LL빈',
    '문화 콘텐츠': '90s 그런지(너바나·펄잼·사운드가든) / 영화 — 파이트 클럽(1999), 캡틴 판타스틱(2016) / 미국 농부·트럭 운전사',
  },
  '청자켓·데님자켓': {
    '제품 콘텐츠': 'ref: instagram.com/p/DW6GF_vlIt4',
    '정보성 콘텐츠': 'ref: instagram.com/p/DVJV25CARHD',
    '문화 콘텐츠': '영화 — 와일드 원(말론 브란도, 1953), 이유 없는 반항(제임스 딘, 1955), 블리트(스티브 맥퀸, 1968)',
    'OOTD 카드뉴스': 'ref: instagram.com/p/DYlTNnElDqG',
    'OOTD 릴스': 'ref1: DYZrizNRHQj / ref2: DXWtY1XAWot',
  },
  '청바지': {
    '정보성 콘텐츠': '리바이스 505/559/569 모델별 차이',
    '문화 콘텐츠': '리바이스 505 록밴드 — 롤링 스톤즈, 라몬즈, 도어즈, 비치 보이즈 / 영화 — 이지 라이더(1969), 텔마와 루이스',
  },
  '바람막이+아노락': {
    '제품 콘텐츠': 'ref: instagram.com/p/DVJV25CARHD',
    '정보성 콘텐츠': 'ref: instagram.com/p/DYJwipXEatd → 변형',
    '문화 콘텐츠': '아노락 흐름 — 이누이트 원조 → 1911 아문센 남극 정복 → 70s 등산 → 90s 오아시스·갤러거 형제 브릿팝',
    'OOTD 카드뉴스': 'ref: instagram.com/p/DYlTNnElDqG',
    'OOTD 릴스': 'ref1: DYZrizNRHQj / ref2: DXWtY1XAWot',
  },
  '플리스': {
    '정보성 콘텐츠': '"플리스 원조는 파타고니아가 아니다" — 헬리한센 1961',
    '문화 콘텐츠': '노르웨이 벌목꾼 1961 / 파타고니아 80s 캘리포니아 클라이밍 / 영화 — 월터의 상상은 현실이 된다(2013), 메루(2015)',
  },
  '패딩조끼': {
    '정보성 콘텐츠': '패딩베스트 헤리티지 — 에디바우어 시작',
    '문화 콘텐츠': '90s 힙합 올드머니 / 80s 등산 붐 / 영화 — 더 로열 테넌바움(웨스 앤더슨, 2001, 리치 테넌바움 트레이닝 룩)',
  },
  '마운틴파카': {
    '제품 콘텐츠': 'ref: instagram.com/p/DVJV25CARHD',
    '정보성 콘텐츠': 'ref: instagram.com/p/DYJwipXEatd → 60/40 변형',
    '문화 콘텐츠': '70s 미국 백패킹 붐 · 시에라 클럽 · 60/40 코튼·나일론 / 영화 — 인투 더 와일드(2007), 와일드(2014)',
    'OOTD 카드뉴스': 'ref: instagram.com/p/DYlTNnElDqG',
    'OOTD 릴스': 'ref1: DYZrizNRHQj / ref2: DXWtY1XAWot',
  },
  '패딩': {
    '정보성 콘텐츠': '다운파카 발달사 — 에디바우어 Skyliner(1936)',
    '문화 콘텐츠': '80s 노르웨이 등산가 · 에베레스트 1953 / 영화 — 에베레스트(2015), K2(1991), 클리프행어',
  },
  '맨투맨·후드티': {
    '정보성 콘텐츠': '챔피언 · 러셀 · 헤인즈 빈티지 헤리티지',
    '문화 콘텐츠': '영화 — 록키(1976, 회색 트레이닝), 굿 윌 헌팅(1997) / 풋볼 컬리지 시대 / 챔피언 90s 빅 사이즈',
  },
  '필드·헌팅자켓': {
    '정보성 콘텐츠': 'M-65 · OG-107 야상 · 영국군 P64 군복 헤리티지',
    '문화 콘텐츠': '영화 — 택시 드라이버(1976, 트래비스 M-65), 풀 메탈 자켓(1987), 디어 헌터(1978) / 모드 vs 로커, 펑크 신',
  },
  '코위찬·헤비스웨터': {
    '정보성 콘텐츠': '코위찬 부족(Cowichan) 손뜨개 · 피셔맨 스웨터 헤리티지',
    '문화 콘텐츠': '캐나다 원주민 부족 문화 / 영화 — 빅 르보스키(1998, 더 듀드 가디건), 더 미션(1986)',
  },
  '코듀로이': {
    '정보성 콘텐츠': '코듀로이 소재 발달사 — 영국 워크웨어에서 미국 60s~70s 캐주얼로',
    '문화 콘텐츠': '영화 — 더 로열 테넌바움, 라이프 어쿼틱(웨스 앤더슨), 보이후드(2014), 라스트 픽처 쇼(1971) / 매튜 매커너히 70s 룩',
  },
};

// 1. 기존 progress_items 삭제 (모든 시즌 카테고리)
console.log('\n[1] 기존 progress_items 삭제');
const allCatIds = CALENDAR.map((c) => c.cat_id);
for (const cat_id of allCatIds) {
  await supabase.from('progress_items').delete().eq('category_id', cat_id);
}
console.log(`  ✓ ${allCatIds.length}개 카테고리 진행 항목 초기화`);

// 2. 새 진행 항목 입력
console.log('\n[2] 새 진행 항목 입력');
let totalItems = 0;
for (const cat of CALENDAR) {
  const startDate = new Date(cat.start);
  for (let i = 0; i < CONTENT_PATTERN.length; i++) {
    const pattern = CONTENT_PATTERN[i];
    const d = new Date(startDate);
    d.setDate(d.getDate() + pattern.offset);
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const ref = REFS[cat.cat_name]?.[pattern.type] || null;
    const { error } = await supabase.from('progress_items').insert({
      category_id: cat.cat_id,
      label: `${dateStr} (${pattern.day}) — ${pattern.type}`,
      notes: ref,
      status: 'todo',
      sort_order: i,
    });
    if (error) {
      console.error(`  ✗ ${cat.cat_id}: ${error.message}`);
    } else {
      totalItems++;
    }
  }
  console.log(`  ✓ ${cat.cat_name.padEnd(20)} 6개 항목 (${cat.start} 주부터)`);
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`완료 — 12개 카테고리 × 6콘텐츠 = ${totalItems}개 진행 항목`);
console.log('사이트 새로고침해서 확인하세요.');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
