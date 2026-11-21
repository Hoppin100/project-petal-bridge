import { describe, expect, it } from 'vitest';
import type { Category } from '@/lib/types';
import {
  categoriesForType,
  gameTabs,
  groupCategories,
  resolveGameTab,
  supportedCompetitionTypes,
} from '@/lib/game-tabs';

function category(overrides: Partial<Category> & Pick<Category, 'id' | 'name'>): Category {
  return {
    game_id: 'game-1',
    parent_category_id: null,
    timing_rules: null,
    sort_order: 0,
    created_at: '',
    competition_type: 'speedrun',
    record_unit: null,
    record_description: null,
    record_rules: null,
    record_higher_is_better: true,
    ...overrides,
  };
}

const speedrun = category({ id: 's1', name: 'Any%' });
const record = category({ id: 'r1', name: 'Most Coins', competition_type: 'record', record_unit: 'Coins' });

describe('game tab visibility', () => {
  it('shows every tab for a game with both competition types', () => {
    const support = supportedCompetitionTypes([speedrun, record]);
    expect(support).toEqual({ speedruns: true, records: true });
    expect(gameTabs(support).map((tab) => tab.id)).toEqual([
      'overview',
      'speedruns',
      'records',
      'guides',
      'forums',
    ]);
  });

  it('hides the records tab for a speedruns-only game', () => {
    const tabs = gameTabs(supportedCompetitionTypes([speedrun]));
    expect(tabs.map((tab) => tab.id)).toEqual([
      'overview',
      'speedruns',
      'guides',
      'forums',
    ]);
  });

  it('hides the speedruns tab for a records-only game', () => {
    const tabs = gameTabs(supportedCompetitionTypes([record]));
    expect(tabs.map((tab) => tab.id)).toEqual([
      'overview',
      'records',
      'guides',
      'forums',
    ]);
  });

  it('still offers guides and forums when a game has no competitions', () => {
    const support = supportedCompetitionTypes([]);
    expect(support).toEqual({ speedruns: false, records: false });
    expect(gameTabs(support).map((tab) => tab.id)).toEqual(['overview', 'guides', 'forums']);
  });

  it('falls back to overview when the requested tab is not available', () => {
    const tabs = gameTabs(supportedCompetitionTypes([speedrun]));
    expect(resolveGameTab('records', tabs)).toBe('overview');
    expect(resolveGameTab('guides', tabs)).toBe('guides');
    expect(resolveGameTab(null, tabs)).toBe('overview');
  });
});

describe('competition separation', () => {
  it('never returns record categories in the speedrun list or the reverse', () => {
    const categories = [speedrun, record];
    expect(categoriesForType(categories, 'speedrun').map((item) => item.id)).toEqual(['s1']);
    expect(categoriesForType(categories, 'record').map((item) => item.id)).toEqual(['r1']);
  });

  it('keeps identical names apart when the competition type differs', () => {
    const duplicateName = category({
      id: 'r2',
      name: 'Any%',
      competition_type: 'record',
      record_unit: 'Points',
    });
    const categories = [speedrun, duplicateName];
    expect(categoriesForType(categories, 'speedrun')).toHaveLength(1);
    expect(categoriesForType(categories, 'record')).toHaveLength(1);
  });
});

describe('category grouping', () => {
  it('groups subcategories under their parent even when names repeat elsewhere', () => {
    const parentA = category({ id: 'a', name: 'Glitchless', sort_order: 1 });
    const parentB = category({
      id: 'b',
      name: 'Glitchless',
      sort_order: 2,
      competition_type: 'record',
      record_unit: 'Points',
    });
    const childA = category({ id: 'a1', name: 'Easy', parent_category_id: 'a', sort_order: 1 });
    const childB = category({
      id: 'b1',
      name: 'Easy',
      parent_category_id: 'b',
      sort_order: 1,
      competition_type: 'record',
      record_unit: 'Points',
    });

    const groups = groupCategories([childB, parentB, childA, parentA]);
    expect(groups.map((group) => group.main.id)).toEqual(['a', 'b']);
    expect(groups[0]?.children.map((child) => child.id)).toEqual(['a1']);
    expect(groups[1]?.children.map((child) => child.id)).toEqual(['b1']);
  });
});
