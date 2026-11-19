import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SubmitRunPage } from '@/views/SubmitRunPage';

const auth = vi.hoisted(() => {
  const state = {
    session: null as unknown,
    profile: null as unknown,
    loading: false,
    refreshProfile: async () => {},
    signOut: async () => {},
  };
  return { state };
});

const client = vi.hoisted(() => ({
  games: [] as unknown[],
  categories: [] as unknown[],
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => auth.state as never,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain: unknown = new Proxy(function () {}, {
        get(_target, prop) {
          if (prop === 'then') {
            return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve({
                data: table === 'games' ? client.games : client.categories,
                error: null,
              }).then(resolve, reject);
          }
          if (prop === 'catch' || prop === 'finally') return undefined;
          return () => chain;
        },
      });
      return chain;
    },
  },
}));

vi.mock('@/lib/verify-run.functions', () => ({
  runVerification: async () => ({}),
}));

function category(overrides: Record<string, unknown>) {
  return {
    id: 'record-1',
    game_id: 'game-id',
    parent_category_id: null,
    name: 'Most Kills in One Match',
    timing_rules: null,
    sort_order: 1,
    created_at: '',
    competition_type: 'record',
    record_unit: 'Kills',
    record_description: 'Eliminations in a single match.',
    record_rules: 'Standard mode only.',
    record_higher_is_better: true,
    ...overrides,
  };
}

describe('Submit page competition types', () => {
  beforeEach(() => {
    auth.state.session = { user: { id: 'runner-id' } };
    auth.state.profile = { id: 'runner-id', role: 'member' };
    auth.state.loading = false;
    client.games = [{ id: 'game-id', slug: 'test-game', title: 'Test game' }];
    client.categories = [];
  });

  it('shows a numeric record input and never a time input for records', async () => {
    client.categories = [category({})];

    render(<SubmitRunPage onRequireAuth={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Game'), { target: { value: 'game-id' } });

    const valueInput = await screen.findByLabelText('Record value');
    expect(valueInput).toHaveAttribute('type', 'number');
    expect(screen.getAllByText('Kills').length).toBeGreaterThan(0);
    expect(screen.getByText('Eliminations in a single match.')).toBeInTheDocument();
    expect(screen.getByText(/Standard mode only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit record/ })).toBeInTheDocument();

    expect(screen.queryByLabelText(/Completion time/)).toBeNull();
    expect(screen.queryByLabelText(/Run starts in video/)).toBeNull();
    expect(screen.queryByLabelText(/Run ends in video/)).toBeNull();
    expect(screen.queryByText('Time')).toBeNull();
  });

  it('keeps the existing time and marker inputs for speedruns', async () => {
    client.categories = [
      category({
        id: 'speed-1',
        name: 'Any%',
        competition_type: 'speedrun',
        record_unit: null,
        record_description: null,
        record_rules: null,
      }),
    ];

    render(<SubmitRunPage onRequireAuth={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Game'), { target: { value: 'game-id' } });

    await screen.findByLabelText(/Completion time/);
    expect(screen.getByLabelText(/Run starts in video/)).toBeRequired();
    expect(screen.getByLabelText(/Run ends in video/)).toBeRequired();
    expect(screen.getByRole('button', { name: /Submit run/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Record value')).toBeNull();
  });

  it('lists speedrun and record competitions side by side for the same game', async () => {
    client.categories = [
      category({ id: 'speed-1', name: 'Any%', competition_type: 'speedrun', record_unit: null }),
      category({ id: 'record-1', name: 'Most Kills', record_unit: 'Kills' }),
    ];

    render(<SubmitRunPage onRequireAuth={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Game'), { target: { value: 'game-id' } });

    await waitFor(() => expect(screen.getByRole('button', { name: /Any%/ })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Most Kills/ })).toBeInTheDocument();
  });
});
