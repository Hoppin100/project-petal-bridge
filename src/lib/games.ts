import { supabase } from '@/lib/supabase';
import type { Game } from '@/lib/types';

const GAME_COLUMNS =
  'id, slug, title, cover_url, blurb, page_url, source, is_featured, created_at';
const BASE_GAME_COLUMNS =
  'id, slug, title, cover_url, blurb, is_featured, created_at';

type GameQueryResult = { games: Game[]; error: string | null };

function isMissingOptionalColumn(error: { code?: string; message: string }) {
  return (
    (error.code === '42703' || error.code === 'PGRST204') &&
    /(page_url|source)/i.test(error.message)
  );
}

/**
 * Read games across databases where the optional page_url/source migrations
 * may not have been applied yet. The core game list remains available while
 * the migration is pending, and the UI can still show a useful error if the
 * underlying games table itself cannot be read.
 */
export async function fetchGames(): Promise<GameQueryResult> {
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .order('title');

  if (!error) return { games: (data as Game[]) ?? [], error: null };
  if (!isMissingOptionalColumn(error)) {
    return { games: [], error: error.message };
  }

  const { data: baseData, error: baseError } = await supabase
    .from('games')
    .select(BASE_GAME_COLUMNS)
    .order('title');

  return baseError
    ? { games: [], error: baseError.message }
    : { games: (baseData as Game[]) ?? [], error: null };
}

export async function fetchGameBySlug(slug: string) {
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (!error) return { game: data as Game | null, error: null };
  if (!isMissingOptionalColumn(error)) {
    return { game: null, error: error.message };
  }

  const { data: baseData, error: baseError } = await supabase
    .from('games')
    .select(BASE_GAME_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  return baseError
    ? { game: null, error: baseError.message }
    : { game: baseData as Game | null, error: null };
}
