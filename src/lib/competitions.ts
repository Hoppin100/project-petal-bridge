import { supabase } from '@/lib/supabase';
import type {
  Category,
  CompetitionType,
  RecordSubmission,
} from '@/lib/types';

/**
 * Competition type helpers.
 *
 * A game is never limited to one type: every category carries its own
 * competition type, so speedrun boards and record boards coexist on the same
 * game page.
 */

export const COMPETITION_COLUMNS =
  'id, game_id, parent_category_id, name, timing_rules, sort_order, created_at, competition_type, record_unit, record_description, record_rules, record_higher_is_better';

/** Columns that exist before migration 0009 is applied. */
export const LEGACY_COMPETITION_COLUMNS =
  'id, game_id, parent_category_id, name, timing_rules, sort_order, created_at';

export const RECORD_SUBMISSION_COLUMNS =
  'id, game_id, category_id, submitter_id, value_numeric, platform, video_url, video_id, video_start_seconds, video_end_seconds, status, rejection_reason, moderator_notes, notes, verified_by, verified_at, created_at';

export function isMissingCompetitionColumns(error: {
  code?: string;
  message: string;
}): boolean {
  return (
    (error.code === '42703' || error.code === 'PGRST204') &&
    /(competition_type|record_unit|record_description|record_rules|record_higher_is_better)/i.test(
      error.message,
    )
  );
}

/** Older databases predate migration 0009: treat those boards as speedruns. */
export function normalizeCategory(row: Partial<Category>): Category {
  return {
    ...row,
    timing_rules: row.timing_rules ?? null,
    competition_type: row.competition_type === 'record' ? 'record' : 'speedrun',
    record_unit: row.record_unit ?? null,
    record_description: row.record_description ?? null,
    record_rules: row.record_rules ?? null,
    record_higher_is_better: row.record_higher_is_better ?? true,
  } as Category;
}

export function isRecordCategory(
  category: Pick<Category, 'competition_type'> | null | undefined,
): boolean {
  return category?.competition_type === 'record';
}

export function competitionTypeLabel(type: CompetitionType): string {
  return type === 'record' ? 'Record' : 'Speedrun';
}

/**
 * Read a game's competitions with a graceful fallback so the site keeps working
 * until migration 0009 is applied.
 */
export async function fetchGameCompetitions(gameId: string): Promise<{
  categories: Category[];
  error: string | null;
  migrationMissing: boolean;
}> {
  const primary = await supabase
    .from('categories')
    .select(COMPETITION_COLUMNS)
    .eq('game_id', gameId)
    .order('sort_order')
    .order('name');

  if (!primary.error) {
    return {
      categories: ((primary.data as Partial<Category>[]) ?? []).map(normalizeCategory),
      error: null,
      migrationMissing: false,
    };
  }
  if (!isMissingCompetitionColumns(primary.error)) {
    return { categories: [], error: primary.error.message, migrationMissing: false };
  }

  const legacy = await supabase
    .from('categories')
    .select(LEGACY_COMPETITION_COLUMNS)
    .eq('game_id', gameId)
    .order('sort_order')
    .order('name');

  return legacy.error
    ? { categories: [], error: legacy.error.message, migrationMissing: true }
    : {
        categories: ((legacy.data as Partial<Category>[]) ?? []).map(normalizeCategory),
        error: null,
        migrationMissing: true,
      };
}

/** Read every game's competitions in one pass (owner tools). */
export async function fetchAllCompetitions(gameIds: string[]): Promise<{
  categories: Category[];
  error: string | null;
  migrationMissing: boolean;
}> {
  if (gameIds.length === 0) {
    return { categories: [], error: null, migrationMissing: false };
  }

  const primary = await supabase
    .from('categories')
    .select(COMPETITION_COLUMNS)
    .in('game_id', gameIds)
    .order('sort_order')
    .order('name');

  if (!primary.error) {
    return {
      categories: ((primary.data as Partial<Category>[]) ?? []).map(normalizeCategory),
      error: null,
      migrationMissing: false,
    };
  }
  if (!isMissingCompetitionColumns(primary.error)) {
    return { categories: [], error: primary.error.message, migrationMissing: false };
  }

  const legacy = await supabase
    .from('categories')
    .select(LEGACY_COMPETITION_COLUMNS)
    .in('game_id', gameIds)
    .order('sort_order')
    .order('name');

  return legacy.error
    ? { categories: [], error: legacy.error.message, migrationMissing: true }
    : {
        categories: ((legacy.data as Partial<Category>[]) ?? []).map(normalizeCategory),
        error: null,
        migrationMissing: true,
      };
}

/* ------------------------------------------------------------------ *
 * Record values
 * ------------------------------------------------------------------ */

/**
 * Sort approved record submissions best-first. Higher-is-better boards put the
 * biggest number first; lower-is-better boards invert that.
 */
export function compareRecordValues(
  first: number,
  second: number,
  higherIsBetter = true,
): number {
  return higherIsBetter ? second - first : first - second;
}

/** Approved submissions only: pending and rejected never count as records. */
export function approvedRecordSubmissions(
  submissions: RecordSubmission[],
): RecordSubmission[] {
  return submissions.filter((submission) => submission.status === 'verified');
}

export interface RankedRecord extends RecordSubmission {
  rank: number;
  /** When this record was beaten, or null while it still stands. */
  beatenAt: string | null;
  beatenByValue: number | null;
}

/**
 * Rank a competition's official results. Every approved submission is kept, so
 * previous holders stay visible with the proof video that earned them the record.
 */
export function rankRecordSubmissions(
  submissions: RecordSubmission[],
  higherIsBetter = true,
): RankedRecord[] {
  const ordered = [...approvedRecordSubmissions(submissions)].sort((a, b) => {
    const byValue = compareRecordValues(
      Number(a.value_numeric),
      Number(b.value_numeric),
      higherIsBetter,
    );
    if (byValue !== 0) return byValue;
    const byDate =
      new Date(a.verified_at ?? a.created_at).getTime() -
      new Date(b.verified_at ?? b.created_at).getTime();
    if (byDate !== 0) return byDate;
    return a.id.localeCompare(b.id);
  });

  return ordered.map((submission, index) => {
    const beatenBy = index === 0 ? null : ordered[index - 1]!;
    return {
      ...submission,
      rank: index + 1,
      beatenAt: beatenBy ? beatenBy.verified_at ?? beatenBy.created_at : null,
      beatenByValue: beatenBy ? Number(beatenBy.value_numeric) : null,
    };
  });
}

export function currentRecord(
  submissions: RecordSubmission[],
  higherIsBetter = true,
): RankedRecord | null {
  return rankRecordSubmissions(submissions, higherIsBetter)[0] ?? null;
}

/** Plain numeric formatting: records never use speedrun time formats. */
export function formatRecordValue(value: number): string {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(numeric);
}

export function formatRecordWithUnit(
  value: number,
  unit: string | null | undefined,
): string {
  const formatted = formatRecordValue(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

/** Parse a numeric record value; returns null when the input is not a number. */
export function parseRecordValue(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, '');
  if (!trimmed || !/^\d+(\.\d{1,3})?$/.test(trimmed)) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

export function recordDirectionLabel(higherIsBetter: boolean): string {
  return higherIsBetter ? 'Highest value wins' : 'Lowest value wins';
}
