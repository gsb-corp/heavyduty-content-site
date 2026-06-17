// 관리자 페이지용 헬퍼 — 단계 정의 재노출 + 정점 날짜에서 단계 데드라인 라벨

import { STAGE_DEFS } from '@/lib/data/types';
import { stageDeadline, formatDeadline } from '@/lib/utils/pipeline';

export { STAGE_DEFS };

/** 정점 날짜 문자열("2026-09-03") + 마감 주 → "M/D (월 N주차)" 라벨 */
export function stageDeadlineLabel(peakDateStr: string, weeksBeforePeak: number): string {
  const peak = new Date(peakDateStr);
  const deadline = stageDeadline(peak, weeksBeforePeak);
  return formatDeadline(deadline);
}
