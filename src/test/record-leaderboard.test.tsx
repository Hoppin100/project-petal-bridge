import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecordLeaderboard } from '@/components/RecordLeaderboard';
import type { Category, Profile, RecordSubmission } from '@/lib/types';

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ profile: null, session: null, loading: false }),
}));

const competition: Category = {
  id: 'record-1',
  game_id: 'game-1',
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
};

function submission(
  id: string,
  value: number,
  status: RecordSubmission['status'],
  submitter: string,
  createdAt: string
): RecordSubmission {
  return {
    id,
    game_id: 'game-1',
    category_id: 'record-1',
    submitter_id: submitter,
    value_numeric: value,
    platform: 'PC',
    video_url: `https://www.youtube.com/watch?v=${id}`,
    video_id: id,
    video_start_seconds: null,
    video_end_seconds: null,
    status,
    rejection_reason: null,
    moderator_notes: null,
    notes: null,
    verified_by: null,
    verified_at: createdAt,
    created_at: createdAt,
  };
}

const submitterMap: Record<string, Profile> = {
  'player-new': {
    id: 'player-new',
    username: 'NewHolder',
    role: 'member',
    bio: null,
    avatar_url: null,
    created_at: '',
  },
  'player-old': {
    id: 'player-old',
    username: 'OldHolder',
    role: 'member',
    bio: null,
    avatar_url: null,
    created_at: '',
  },
};

describe('RecordLeaderboard', () => {
  it('shows only approved values with player, unit, date, proof and history', () => {
    render(
      <RecordLeaderboard
        competition={competition}
        submitterMap={submitterMap}
        submissions={[
          submission('new', 91, 'verified', 'player-new', '2026-02-02T00:00:00.000Z'),
          submission('old', 47, 'verified', 'player-old', '2026-01-02T00:00:00.000Z'),
          submission('pending', 500, 'pending', 'player-new', '2026-03-02T00:00:00.000Z'),
          submission('rejected', 900, 'rejected', 'player-old', '2026-03-03T00:00:00.000Z'),
        ]}
      />
    );

    expect(screen.getAllByText('91').length).toBeGreaterThan(0);
    expect(screen.getAllByText('47').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kills').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NewHolder').length).toBeGreaterThan(0);

    // Pending and rejected values never appear as records.
    expect(screen.queryByText('500')).toBeNull();
    expect(screen.queryByText('900')).toBeNull();

    // Previous holders stay in the history with their own proof.
    expect(screen.getByText(/Record history/)).toBeInTheDocument();
    expect(screen.getAllByText('OldHolder').length).toBeGreaterThan(0);
    const proofLinks = screen.getAllByLabelText(/Watch .* proof video/);
    expect(proofLinks.length).toBeGreaterThan(0);
    expect(proofLinks[0]).toHaveAttribute(
      'href',
      expect.stringContaining('youtube.com/watch')
    );
  });

  it('sorts lower-is-better boards with the smallest value first', () => {
    const lowerCompetition: Category = { ...competition, record_higher_is_better: false };
    render(
      <RecordLeaderboard
        competition={lowerCompetition}
        submitterMap={submitterMap}
        submissions={[
          submission('high', 91, 'verified', 'player-new', '2026-02-02T00:00:00.000Z'),
          submission('low', 7, 'verified', 'player-old', '2026-01-02T00:00:00.000Z'),
        ]}
      />
    );

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('7');
    expect(rows[2]).toHaveTextContent('91');
  });
});
