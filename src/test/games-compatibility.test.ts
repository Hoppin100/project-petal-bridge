import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  replies: [] as Array<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>,
  selectedColumns: [] as string[],
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn((columns: string) => {
        mockState.selectedColumns.push(columns);
        const reply = mockState.replies.shift();
        const query = {
          order: vi.fn().mockResolvedValue(reply),
          eq: vi.fn(),
          maybeSingle: vi.fn(),
        };
        query.eq.mockReturnValue(query);
        query.maybeSingle.mockResolvedValue(reply);
        return query;
      }),
    })),
  },
}));

import { fetchGames, isComingSoonGame } from '@/lib/games';

describe('coming soon detection', () => {
  it.each(['GTA 6', 'GTA VI', 'Grand Theft Auto 6', 'Grand Theft Auto VI'])(
    'recognizes %s',
    (title) => {
      expect(isComingSoonGame({ title })).toBe(true);
    },
  );

  it('does not match other games', () => {
    expect(isComingSoonGame({ title: 'Grand Theft Auto V' })).toBe(false);
    expect(isComingSoonGame({ title: 'Red Dead Redemption 2' })).toBe(false);
  });
});

describe('fetchGames migration compatibility', () => {
  beforeEach(() => {
    mockState.replies = [];
    mockState.selectedColumns = [];
  });

  it('continues loading if the visibility column has not been migrated', async () => {
    mockState.replies.push(
      {
        data: null,
        error: { code: 'PGRST204', message: 'Could not find is_hidden in the schema cache' },
      },
      {
        data: null,
        error: { code: 'PGRST204', message: 'Could not find is_hidden in the schema cache' },
      },
      {
        data: [{ id: 'game-1', slug: 'example', title: 'Example', is_featured: false }],
        error: null,
      },
    );

    const result = await fetchGames();

    expect(result.error).toBeNull();
    expect(result.games).toEqual([
      {
        id: 'game-1',
        slug: 'example',
        title: 'Example',
        is_featured: false,
        page_url: null,
        source: null,
        is_hidden: false,
      },
    ]);
    expect(mockState.selectedColumns[2]).not.toContain('is_hidden');
  });

  it('preserves hidden-game status when only older link columns are missing', async () => {
    mockState.replies.push(
      {
        data: null,
        error: { code: '42703', message: 'column games.page_url does not exist' },
      },
      {
        data: [{ id: 'game-2', slug: 'hidden', title: 'Hidden', is_featured: false, is_hidden: true }],
        error: null,
      },
    );

    const result = await fetchGames();

    expect(result.error).toBeNull();
    expect(result.games[0]?.is_hidden).toBe(true);
    expect(mockState.selectedColumns[1]).toContain('is_hidden');
  });
});
