import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

interface SpeedrunGame {
  id: string;
  names: { international: string; abbreviation?: string };
  weblink?: string;
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function isSpeedrunGame(value: unknown): value is SpeedrunGame {
  if (typeof value !== 'object' || value === null) return false;
  const game = value as Partial<SpeedrunGame>;
  return (
    typeof game.id === 'string' &&
    typeof game.names?.international === 'string' &&
    (game.names.abbreviation === undefined || typeof game.names.abbreviation === 'string')
  );
}

function parseSpeedrunGames(payload: unknown): SpeedrunGame[] {
  if (
    typeof payload !== 'object' ||
    payload === null ||
    !('data' in payload) ||
    !Array.isArray(payload.data) ||
    !payload.data.every(isSpeedrunGame)
  ) {
    throw new Error('speedrun.com returned an unexpected response');
  }
  return payload.data;
}

function safeGameUrl(game: SpeedrunGame, query: string) {
  const fallback = `https://www.speedrun.com/search?q=${encodeURIComponent(query)}`;
  if (!game.weblink) return fallback;

  try {
    const url = new URL(game.weblink);
    return url.protocol === 'https:' &&
      (url.hostname === 'speedrun.com' || url.hostname.endsWith('.speedrun.com'))
      ? url.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

export const lookupSpeedrunGames = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .validator((input: { name: string }) => {
    if (!input || typeof input.name !== 'string') throw new Error('Game name is required');
    const name = input.name.trim();
    if (name.length < 3 || name.length > 100) throw new Error('Game name must be 3–100 characters');
    return { name };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: isOwner, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: context.userId,
      _role: 'owner',
    });
    if (roleError) throw new Error('Could not authorize speedrun.com lookup');
    if (!isOwner) throw new Error('Only an owner can look up speedrun.com games');

    const url = new URL('https://www.speedrun.com/api/v1/games');
    url.searchParams.set('name', data.name);
    url.searchParams.set('max', '5');

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SplitRush speedrun.com game lookup',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`speedrun.com lookup failed (${response.status})`);

    const payload: unknown = await response.json();
    const games = parseSpeedrunGames(payload);
    const normalizedQuery = normalizeName(data.name);

    return {
      games: games.map((game) => ({
        id: game.id,
        name: game.names.international,
        url: safeGameUrl(game, data.name),
        exactMatch:
          normalizeName(game.names.international) === normalizedQuery ||
          (game.names.abbreviation !== undefined &&
            normalizeName(game.names.abbreviation) === normalizedQuery),
      })),
    };
  });
