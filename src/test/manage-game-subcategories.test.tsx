import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManageGamesPage } from '@/views/ManageGamesPage';

const database = vi.hoisted(() => ({
  categories: [] as Array<Record<string, unknown>>,
  nextId: 1,
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    session: { user: { id: 'owner-id' } },
    profile: { id: 'owner-id', role: 'owner' },
    loading: false,
  }),
}));

vi.mock('@/lib/games', () => ({
  fetchGames: async () => ({
    games: [{
      id: 'game-id',
      slug: 'test-game',
      title: 'Test game',
      cover_url: null,
      blurb: null,
      page_url: null,
      source: null,
      is_featured: false,
      is_hidden: false,
      created_at: '',
    }],
    error: null,
  }),
}));

vi.mock('@/lib/speedrun-games.functions', () => ({
  lookupSpeedrunGames: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let action = 'select';
      let payload: Record<string, unknown> | Array<Record<string, unknown>> | null = null;
      const filters: Record<string, unknown> = {};

      const execute = () => {
        if (action === 'insert' && payload) {
          const rows = Array.isArray(payload) ? payload : [payload];
          const inserted = rows.map((row) => ({
            ...row,
            id: `inserted-${database.nextId++}`,
            created_at: '',
          }));
          database.categories.push(...inserted);
          return { data: inserted, error: null };
        }
        if (table !== 'categories') return { data: [], error: null };
        let rows = [...database.categories];
        if (typeof filters['game_id'] === 'string') {
          rows = rows.filter((row) => row['game_id'] === filters['game_id']);
        }
        if (Array.isArray(filters['game_ids'])) {
          rows = rows.filter((row) =>
            (filters['game_ids'] as string[]).includes(String(row['game_id']))
          );
        }
        return { data: rows, error: null };
      };

      const query: Record<string, unknown> = {};
      query['select'] = () => query;
      query['in'] = (column: string, values: unknown) => {
        filters[column === 'game_id' ? 'game_ids' : column] = values;
        return query;
      };
      query['eq'] = (column: string, value: unknown) => {
        filters[column] = value;
        return query;
      };
      query['order'] = () => query;
      query['insert'] = (value: typeof payload) => {
        action = 'insert';
        payload = value;
        return query;
      };
      query['single'] = async () => {
        const { data, error } = execute();
        return { data: data[0] ?? null, error };
      };
      query['then'] = (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown
      ) => Promise.resolve(execute()).then(resolve, reject);

      return query;
    },
  },
}));

describe('Manage game subcategories', () => {
  beforeEach(() => {
    database.categories = [
      {
        id: 'player-1',
        game_id: 'game-id',
        parent_category_id: null,
        name: 'Player 1',
        timing_rules: null,
        sort_order: 10,
      },
      {
        id: 'player-4',
        game_id: 'game-id',
        parent_category_id: null,
        name: 'Player 4',
        timing_rules: null,
        sort_order: 20,
      },
      {
        id: 'glitchless-1',
        game_id: 'game-id',
        parent_category_id: 'player-1',
        name: 'Glitchless',
        timing_rules: 'Original rules',
        sort_order: 10,
      },
    ];
    database.nextId = 1;
  });

  it('creates under the chosen parent and duplicates directly into a different selected parent', async () => {
    render(<ManageGamesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Categories' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add subcategory under Player 4' }));
    const parentSelect = screen.getByLabelText('Category level');
    expect(parentSelect).toHaveValue('player-4');
    fireEvent.change(screen.getByLabelText(/^Category name/), { target: { value: 'Glitchless' } });
    fireEvent.change(screen.getByLabelText(/^Timing rules/), { target: { value: 'New rules' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add category' }));

    await waitFor(() => {
      expect(database.categories).toContainEqual(
        expect.objectContaining({
          game_id: 'game-id',
          parent_category_id: 'player-4',
          name: 'Glitchless',
          timing_rules: 'New rules',
        })
      );
    });

    const sourceRow = screen.getAllByRole('listitem').find((item) =>
      item.textContent?.includes('Original rules')
    );
    expect(sourceRow).toBeDefined();
    fireEvent.click(within(sourceRow!).getByRole('button', { name: 'Duplicate subcategory Glitchless' }));
    expect(screen.getByLabelText(/^Category name/)).toHaveValue('Glitchless (Copy)');
    const duplicateParent = screen.getByLabelText('Category level');
    expect(duplicateParent).toHaveValue('player-1');
    fireEvent.change(duplicateParent, { target: { value: 'player-4' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add category' }));

    await waitFor(() => {
      expect(database.categories).toContainEqual(
        expect.objectContaining({
          game_id: 'game-id',
          parent_category_id: 'player-4',
          name: 'Glitchless (Copy)',
          timing_rules: 'Original rules',
        })
      );
    });
  });

  it('creates a record competition with a measurement unit and direction', async () => {
    render(<ManageGamesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Categories' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    fireEvent.click(screen.getByRole('radio', { name: /^Record/ }));

    const dialog = within(screen.getByRole('dialog'));
    // Record form: numeric wording, no timing-rules field.
    expect(dialog.getByText('New record')).toBeInTheDocument();
    expect(dialog.getByLabelText(/^Record name/)).toBeRequired();
    expect(dialog.getByLabelText(/^Measurement unit/)).toBeRequired();
    expect(dialog.getByLabelText('Leaderboard order')).toHaveValue('higher');
    expect(dialog.queryByLabelText(/^Timing rules/)).toBeNull();

    fireEvent.change(dialog.getByLabelText(/^Record name/), {
      target: { value: 'Most Kills in One Match' },
    });
    fireEvent.change(dialog.getByLabelText(/^Measurement unit/), {
      target: { value: 'Kills' },
    });
    fireEvent.change(dialog.getByLabelText('Leaderboard order'), {
      target: { value: 'lower' },
    });
    fireEvent.change(dialog.getByLabelText(/^Description/), {
      target: { value: 'Eliminations in a single match.' },
    });
    fireEvent.change(dialog.getByLabelText(/^Rules and restrictions/), {
      target: { value: 'Standard mode only.' },
    });
    fireEvent.click(dialog.getByRole('button', { name: 'Add record' }));

    await waitFor(() => {
      expect(database.categories).toContainEqual(
        expect.objectContaining({
          game_id: 'game-id',
          parent_category_id: null,
          name: 'Most Kills in One Match',
          competition_type: 'record',
          record_unit: 'Kills',
          record_higher_is_better: false,
          record_description: 'Eliminations in a single match.',
          record_rules: 'Standard mode only.',
          timing_rules: null,
        })
      );
    });
  });

  it('keeps the speedrun form and default category label unchanged', async () => {
    render(<ManageGamesPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Categories' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }));
    expect(screen.getByRole('radio', { name: /^Speedrun/ })).toBeChecked();
    expect(screen.getByLabelText(/^Category name/)).toBeRequired();
    expect(screen.getByLabelText(/^Timing rules/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Measurement unit/)).toBeNull();
    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Add category' })
    ).toBeInTheDocument();
  });
});
