import { useEffect, useState, useMemo } from 'react';
import { Search, Trophy, Gamepad2, Dices, Send } from 'lucide-react';
import { fetchGames } from '@/lib/games';
import type { Game } from '@/lib/types';
import { GameCard } from '@/components/GameCard';
import { useAuth } from '@/lib/auth';
import { linkHref, goTo } from '@/lib/router';

export function GamesPage() {
  const { profile } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchGames().then(({ games: gameList, error }) => {
      if (cancelled) return;
      setGames(gameList);
      setLoadError(error ?? '');
      setLoading(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      console.error('Could not load games', error);
      setLoadError('Could not connect to the game library. Check your connection and try again.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return games;
    return games.filter(
      (g) =>
        g.title.toLowerCase().includes(q) ||
        (g.blurb?.toLowerCase().includes(q) ?? false)
    );
  }, [games, query]);

  return (
    <div className="sr-container py-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-[var(--sr-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--sr-primary)]">Game library</p>
          <h1 className="text-3xl font-bold">Browse games</h1>
          <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
            {games.length} {games.length === 1 ? 'game' : 'games'}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <button
            type="button"
            disabled={games.length === 0}
            onClick={() => {
              const game = games[Math.floor(Math.random() * games.length)];
              if (game) goTo(`/games/${encodeURIComponent(game.slug)}`);
            }}
            className="sr-btn-ghost min-w-0 flex-1 flex-shrink-0 sm:flex-none"
            title="Open a random game"
          >
            <Dices className="h-4 w-4" />
            <span className="hidden sm:inline">Random game</span>
          </button>
          <a href={linkHref('/request-game')} className="sr-btn-ghost min-w-0 flex-1 flex-shrink-0 sm:flex-none" title="Request a game">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Request game</span>
          </a>
          <div className="relative order-first w-full sm:order-none sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter games..."
              className="sr-input pl-9"
              aria-label="Filter games by title"
            />
          </div>
          {profile?.role === 'owner' && (
            <a href={linkHref('/manage')} className="sr-btn-primary flex-shrink-0">
              <Gamepad2 className="h-4 w-4" />
              <span className="hidden sm:inline">Manage games</span>
              <span className="sm:hidden">Manage</span>
            </a>
          )}
        </div>
      </div>

      {loadError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 border-l-2 border-red-400 bg-[var(--sr-surface)] px-3 py-3 text-sm text-[var(--sr-text-dim)]">
          <span>Games could not be loaded. {loadError}</span>
          <button type="button" className="sr-btn-ghost min-h-8 py-1" onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="sr-card h-64 animate-pulse bg-[var(--sr-surface-2)]"
            />
          ))}
        </div>
      ) : filtered.length === 0 && !loadError ? (
        <div className="sr-card flex flex-col items-center gap-2 p-12 text-center">
          <Trophy className="h-10 w-10 text-emerald-800" />
          <p className="text-emerald-100">No games found</p>
          <p className="text-sm text-emerald-700">
            Try a different search term.
          </p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

