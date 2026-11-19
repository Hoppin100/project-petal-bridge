import { describe, expect, it } from 'vitest';

import {
  formatRecordValue,
  formatRecordWithUnit,
  parseRecordValue,
  rankRecordSubmissions,
} from '@/lib/competitions';
import type { RecordSubmission } from '@/lib/types';

function submission(
  id: string,
  value: number,
  status: RecordSubmission['status'],
  createdAt = '2026-01-01T00:00:00.000Z',
  verifiedAt: string | null = null
): RecordSubmission {
  return {
    id,
    game_id: 'game-1',
    category_id: 'record-1',
    submitter_id: `player-${id}`,
    value_numeric: value,
    platform: 'PC',
    video_url: `https://www.youtube.com/watch?v=video${id}`,
    video_id: `video${id}`,
    video_start_seconds: null,
    video_end_seconds: null,
    status,
    rejection_reason: null,
    moderator_notes: null,
    notes: null,
    verified_by: null,
    verified_at: verifiedAt,
    created_at: createdAt,
  };
}

describe('record leaderboards', () => {
  it('ranks verified submissions highest-first by default', () => {
    const ranked = rankRecordSubmissions([
      submission('a', 47, 'verified'),
      submission('b', 91, 'verified'),
      submission('c', 12, 'verified'),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(['b', 'a', 'c']);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it('ranks lower-is-better boards in ascending order', () => {
    const ranked = rankRecordSubmissions(
      [submission('a', 4, 'verified'), submission('b', 2, 'verified')],
      false
    );

    expect(ranked.map((entry) => entry.id)).toEqual(['b', 'a']);
  });

  it('never ranks pending or rejected submissions as records', () => {
    const ranked = rankRecordSubmissions([
      submission('a', 47, 'pending'),
      submission('b', 91, 'verified'),
      submission('c', 500, 'rejected'),
    ]);

    expect(ranked.map((entry) => entry.id)).toEqual(['b']);
  });

  it('keeps previous holders with the date they were beaten', () => {
    const ranked = rankRecordSubmissions([
      submission('old', 47, 'verified', '2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z'),
      submission('new', 91, 'verified', '2026-02-01T00:00:00.000Z', '2026-02-02T00:00:00.000Z'),
    ]);

    expect(ranked[0]!.id).toBe('new');
    expect(ranked[0]!.beatenAt).toBeNull();
    expect(ranked[1]!.id).toBe('old');
    expect(ranked[1]!.beatenAt).toBe('2026-02-02T00:00:00.000Z');
    expect(ranked[1]!.video_url).toContain('videoold');
    expect(ranked[1]!.beatenByValue).toBe(91);
  });
});

describe('record value formatting', () => {
  it('formats plain numbers without time formatting', () => {
    expect(formatRecordValue(47)).toBe('47');
    expect(formatRecordValue(1234.5)).toBe('1,234.5');
    expect(formatRecordValue(60000)).toBe('60,000');
    expect(formatRecordValue(47)).not.toContain(':');
  });

  it('appends the measurement unit', () => {
    expect(formatRecordWithUnit(47, 'Kills')).toBe('47 Kills');
    expect(formatRecordWithUnit(47, null)).toBe('47');
  });

  it('parses numeric input and rejects times or text', () => {
    expect(parseRecordValue('47')).toBe(47);
    expect(parseRecordValue(' 1,234.5 ')).toBe(1234.5);
    expect(parseRecordValue('0')).toBeNull();
    expect(parseRecordValue('1:23')).toBeNull();
    expect(parseRecordValue('01:23.456')).toBeNull();
    expect(parseRecordValue('abc')).toBeNull();
    expect(parseRecordValue('')).toBeNull();
  });
});
