import { supabase } from '@/lib/supabase';
import type { Game } from '@/lib/types';

const GAME_COLUMNS =
  'id, slug, title, cover_url, blurb, page_url, source, is_featured, is_hidden, created_at';
const BASE_GAME_COLUMNS =
  'id, slug, title, cover_url, blurb, is_featured, is_hidden, created_at';
const CORE_GAME_COLUMNS = 'id, slug, title, cover_url, blurb, is_featured, created_at';

type GameQueryResult = { games: Game[]; error: string | null };

export function isComingSoonGame(game: Pick<Game, 'title'>): boolean {
  const title = game.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return /\bgta\s*(?:6|vi)\b|\bgrand theft auto\s*(?:6|vi)\b/.test(title);
}

function isMissingOptionalColumn(error: { code?: string; message: string }) {
  return (
    (error.code === '42703' || error.code === 'PGRST204') &&
    /(page_url|source|is_hidden)/i.test(error.message)
  );
}

function normalizeGame(game: Partial<Game>): Game {
  return {
    ...game,
    page_url: game.page_url ?? null,
    source: game.source ?? null,
    is_hidden: game.is_hidden ?? false,
  } as Game;
}

function normalizeGames(games: Partial<Game>[] | null): Game[] {
  return (games ?? []).map(normalizeGame);
}

/**
 * Read games while optional game-detail and visibility migrations are being
 * applied. Core game data remains available until those columns are present.
 */
export async function fetchGames(): Promise<GameQueryResult> {
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .order('title');

  if (!error) return { games: normalizeGames(data as Partial<Game>[] | null), error: null };
  if (!isMissingOptionalColumn(error)) {
    return { games: [], error: error.message };
  }

  const { data: baseData, error: baseError } = await supabase
    .from('games')
    .select(BASE_GAME_COLUMNS)
    .order('title');

  if (!baseError) return { games: normalizeGames(baseData as Partial<Game>[] | null), error: null };
  if (!isMissingOptionalColumn(baseError)) {
    return { games: [], error: baseError.message };
  }

  const { data: coreData, error: coreError } = await supabase
    .from('games')
    .select(CORE_GAME_COLUMNS)
    .order('title');

  return coreError
    ? { games: [], error: coreError.message }
    : { games: normalizeGames(coreData as Partial<Game>[] | null), error: null };
}

export async function fetchGameBySlug(slug: string) {
  const { data, error } = await supabase
    .from('games')
    .select(GAME_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (!error) {
    return { game: data ? normalizeGame(data as Partial<Game>) : null, error: null };
  }
  if (!isMissingOptionalColumn(error)) {
    return { game: null, error: error.message };
  }

  const { data: baseData, error: baseError } = await supabase
    .from('games')
    .select(BASE_GAME_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  if (!baseError) {
    return { game: baseData ? normalizeGame(baseData as Partial<Game>) : null, error: null };
  }
  if (!isMissingOptionalColumn(baseError)) return { game: null, error: baseError.message };

  const { data: coreData, error: coreError } = await supabase
    .from('games')
    .select(CORE_GAME_COLUMNS)
    .eq('slug', slug)
    .maybeSingle();

  return coreError
    ? { game: null, error: coreError.message }
    : { game: coreData ? normalizeGame(coreData as Partial<Game>) : null, error: null };
}
