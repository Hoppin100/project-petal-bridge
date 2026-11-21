import type { Category, CompetitionType } from '@/lib/types';

export type GameTab = 'overview' | 'speedruns' | 'records' | 'guides' | 'forums';

export interface GameTabMeta {
  id: GameTab;
  label: string;
}

export interface CompetitionSupport {
  speedruns: boolean;
  records: boolean;
}

/**
 * Support is derived from the categories that actually exist, so a game can
 * never claim a competition type it has no boards for. A game with no
 * categories supports neither type, but still has Guides and Forums.
 */
export function supportedCompetitionTypes(
  categories: Pick<Category, 'competition_type'>[],
): CompetitionSupport {
  return {
    speedruns: categories.some((category) => category.competition_type !== 'record'),
    records: categories.some((category) => category.competition_type === 'record'),
  };
}

/** Tab order is fixed; Speedruns and Records only appear when supported. */
export function gameTabs(support: CompetitionSupport): GameTabMeta[] {
  return [
    { id: 'overview', label: 'Overview' },
    ...(support.speedruns ? [{ id: 'speedruns' as const, label: 'Speedruns' }] : []),
    ...(support.records ? [{ id: 'records' as const, label: 'Records' }] : []),
    { id: 'guides', label: 'Guides' },
    { id: 'forums', label: 'Forums' },
  ];
}

/** Keep a valid tab selected when a game's competition types change. */
export function resolveGameTab(
  requested: GameTab | null | undefined,
  tabs: GameTabMeta[],
): GameTab {
  if (requested && tabs.some((tab) => tab.id === requested)) return requested;
  return 'overview';
}

export function categoriesForType(categories: Category[], type: CompetitionType): Category[] {
  return categories.filter((category) =>
    type === 'record'
      ? category.competition_type === 'record'
      : category.competition_type !== 'record',
  );
}

/**
 * Main categories in display order, each with its subcategories. Identical
 * names are kept as separate rows: only the id decides identity.
 */
export function groupCategories(categories: Category[]): Array<{
  main: Category;
  children: Category[];
}> {
  const mains = categories
    .filter((category) => !category.parent_category_id)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return mains.map((main) => ({
    main,
    children: categories
      .filter((category) => category.parent_category_id === main.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)),
  }));
}
