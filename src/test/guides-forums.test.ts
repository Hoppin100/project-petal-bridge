import { describe, expect, it } from 'vitest';
import type { ForumPost, ForumThread, Guide } from '@/lib/types';
import { canEditGuide, filterGuides, guideCategoryLabel, sortGuides } from '@/lib/guides';
import {
  buildPostTree,
  filterThreads,
  forumCategoryLabel,
  sortThreads,
} from '@/lib/forums';

function guide(overrides: Partial<Guide> & Pick<Guide, 'id' | 'title'>): Guide {
  return {
    game_id: 'game-1',
    author_id: 'author-1',
    summary: null,
    category: 'beginner',
    status: 'published',
    cover_image_url: null,
    helpful_count: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    published_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function thread(overrides: Partial<ForumThread> & Pick<ForumThread, 'id' | 'title'>): ForumThread {
  return {
    game_id: 'game-1',
    author_id: 'author-1',
    body: '',
    category: 'general',
    is_pinned: false,
    is_locked: false,
    is_solved: false,
    accepted_post_id: null,
    score: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    reply_count: 0,
    ...overrides,
  };
}

function post(overrides: Partial<ForumPost> & Pick<ForumPost, 'id'>): ForumPost {
  return {
    thread_id: 'thread-1',
    parent_post_id: null,
    author_id: 'author-1',
    body: '',
    score: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('guide list helpers', () => {
  it('sorts newest by published date and helpful by votes', () => {
    const older = guide({ id: 'g1', title: 'Older', published_at: '2026-01-01T00:00:00.000Z' });
    const newer = guide({
      id: 'g2',
      title: 'Newer',
      published_at: '2026-03-01T00:00:00.000Z',
      helpful_count: 9,
    });
    expect(sortGuides([older, newer], 'newest').map((item) => item.id)).toEqual(['g2', 'g1']);
    expect(sortGuides([older, newer], 'helpful').map((item) => item.id)).toEqual(['g2', 'g1']);
    expect(sortGuides([newer, older], 'title').map((item) => item.id)).toEqual(['g2', 'g1']);
  });

  it('filters by category and search term without losing category names', () => {
    const beginner = guide({ id: 'g1', title: 'First steps', category: 'beginner' });
    const glitch = guide({ id: 'g2', title: 'Wall clip', category: 'glitch', summary: 'Skip the gate' });

    expect(filterGuides([beginner, glitch], { category: 'glitch' }).map((item) => item.id)).toEqual(['g2']);
    expect(filterGuides([beginner, glitch], { search: 'gate' }).map((item) => item.id)).toEqual(['g2']);
    expect(filterGuides([beginner, glitch], { search: 'zebra' })).toEqual([]);
  });

  it('lets the author and staff edit a guide but not other members', () => {
    const entry = guide({ id: 'g1', title: 'Route', author_id: 'author-1' });
    expect(canEditGuide(entry, { id: 'author-1', role: 'member' })).toBe(true);
    expect(canEditGuide(entry, { id: 'other', role: 'member' })).toBe(false);
    expect(canEditGuide(entry, { id: 'mod', role: 'moderator' })).toBe(true);
    expect(canEditGuide(entry, { id: 'boss', role: 'owner' })).toBe(true);
    expect(canEditGuide(entry, null)).toBe(false);
  });

  it('has a label for every required guide category', () => {
    expect(guideCategoryLabel('beginner')).toBe('Beginner Guides');
    expect(guideCategoryLabel('advanced')).toBe('Advanced Strategies');
    expect(guideCategoryLabel('walkthrough')).toBe('Walkthroughs');
    expect(guideCategoryLabel('tips')).toBe('Tips and Tricks');
    expect(guideCategoryLabel('glitch')).toBe('Glitch and Technique Explanations');
  });
});

describe('forum list helpers', () => {
  it('keeps pinned discussions on top regardless of sort', () => {
    const pinned = thread({
      id: 't1',
      title: 'Rules',
      is_pinned: true,
      created_at: '2025-01-01T00:00:00.000Z',
    });
    const busy = thread({ id: 't2', title: 'Busy', score: 50, created_at: '2026-01-01T00:00:00.000Z' });
    expect(sortThreads([busy, pinned], 'top').map((item) => item.id)).toEqual(['t1', 't2']);
    expect(sortThreads([pinned, busy], 'newest').map((item) => item.id)).toEqual(['t1', 't2']);
  });

  it('filters discussions by category and body text', () => {
    const help = thread({ id: 't1', title: 'Stuck', body: 'How do I open the gate?', category: 'help' });
    const tips = thread({ id: 't2', title: 'Movement', body: 'Dash cancels', category: 'tips' });
    expect(filterThreads([help, tips], { category: 'help' }).map((item) => item.id)).toEqual(['t1']);
    expect(filterThreads([help, tips], { search: 'dash' }).map((item) => item.id)).toEqual(['t2']);
    expect(filterThreads([help, tips], { search: 'nothing' })).toEqual([]);
  });

  it('builds nested replies and keeps orphaned replies at the root', () => {
    const root = post({ id: 'p1', created_at: '2026-01-01T00:00:00.000Z' });
    const child = post({
      id: 'p2',
      parent_post_id: 'p1',
      created_at: '2026-01-02T00:00:00.000Z',
    });
    const grandchild = post({
      id: 'p3',
      parent_post_id: 'p2',
      created_at: '2026-01-03T00:00:00.000Z',
    });
    const orphan = post({ id: 'p4', parent_post_id: 'missing' });

    const tree = buildPostTree([grandchild, child, root, orphan]);
    expect(tree.map((item) => item.id).sort()).toEqual(['p1', 'p4']);
    const rootNode = tree.find((item) => item.id === 'p1');
    expect(rootNode?.replies?.map((item) => item.id)).toEqual(['p2']);
    expect(rootNode?.replies?.[0]?.replies?.map((item) => item.id)).toEqual(['p3']);
  });

  it('has a label for every required forum category', () => {
    expect(forumCategoryLabel('general')).toBe('General Discussion');
    expect(forumCategoryLabel('help')).toBe('Game Help');
    expect(forumCategoryLabel('strategies')).toBe('Strategies');
    expect(forumCategoryLabel('questions')).toBe('Questions');
    expect(forumCategoryLabel('tips')).toBe('Tips and Tricks');
  });
});
