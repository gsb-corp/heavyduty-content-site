// 카테고리 데이터에서 특정 주차의 액션 추출

import type { Category, WeekAction } from '../data/types';
import { isSameWeek } from './date';

/**
 * 특정 주차의 모든 액션 추출 (사입/오픈/피크)
 */
export function getActionsForWeek(
  categories: Category[],
  weekLabel: string
): WeekAction[] {
  const actions: WeekAction[] = [];

  for (const cat of categories) {
    for (const cycle of cat.cycles) {
      const common = {
        categoryId: cat.id,
        categoryName: cat.name,
        cycleType: cycle.type,
        cycleSeason: cycle.season,
        note: cycle.note,
        cycleId: cycle.id,
      };

      if (isSameWeek(cycle.sourcing_week, weekLabel)) {
        actions.push({ ...common, actionType: 'sourcing', week: cycle.sourcing_week });
      }
      if (isSameWeek(cycle.open_week, weekLabel)) {
        actions.push({ ...common, actionType: 'open', week: cycle.open_week });
      }
      if (isSameWeek(cycle.peak_week, weekLabel)) {
        actions.push({ ...common, actionType: 'peak', week: cycle.peak_week });
      }
    }
  }

  return actions;
}

/**
 * 액션을 타입별로 그룹화
 */
export function groupActionsByType(actions: WeekAction[]) {
  return {
    sourcing: actions.filter(a => a.actionType === 'sourcing'),
    open: actions.filter(a => a.actionType === 'open'),
    peak: actions.filter(a => a.actionType === 'peak'),
  };
}
