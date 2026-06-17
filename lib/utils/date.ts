// 날짜 유틸 - 오늘 기준 "월 N주차" 계산 및 매칭

/**
 * 날짜를 "X월 N주차" 형식으로 변환
 * 주차 정의: 1-7일 = 1주차, 8-14일 = 2주차, 15-21일 = 3주차, 22일~말일 = 4주차
 */
export function dateToWeekLabel(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  let week = Math.ceil(day / 7);
  if (week > 4) week = 4;
  return `${month}월 ${week}주차`;
}

/**
 * 오늘 날짜의 "월 N주차" 반환
 */
export function todayWeekLabel(): string {
  return dateToWeekLabel(new Date());
}

/**
 * 특정 주차 라벨에 N주를 더하거나 뺀 라벨 반환
 * 예: addWeeksToLabel("9월 3주차", 1) → "9월 4주차"
 */
export function addWeeksToLabel(label: string, deltaWeeks: number): string {
  const match = label.match(/(\d+)월\s*(\d+)주차/);
  if (!match) return label;
  const month = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // 절대 주차 번호 계산 (1년 48주 시스템)
  let absWeek = (month - 1) * 4 + week + deltaWeeks;
  // 1~48 범위로 정규화
  while (absWeek < 1) absWeek += 48;
  while (absWeek > 48) absWeek -= 48;

  const newMonth = Math.ceil(absWeek / 4);
  const newWeek = ((absWeek - 1) % 4) + 1;
  return `${newMonth}월 ${newWeek}주차`;
}

/**
 * "12월 3주차 (전년)" 같은 라벨에서 주차 부분만 추출
 */
export function normalizeWeekLabel(label: string): string {
  return label.replace(/\s*\(전년\)/, '').trim();
}

/**
 * 두 주차 라벨이 같은지 비교
 */
export function isSameWeek(a: string, b: string): boolean {
  return normalizeWeekLabel(a) === normalizeWeekLabel(b);
}

/**
 * 다음 주 라벨 반환
 */
export function nextWeekLabel(): string {
  const next = new Date();
  next.setDate(next.getDate() + 7);
  return dateToWeekLabel(next);
}
