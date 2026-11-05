import { useEffect, useState, useMemo, useRef } from 'react';
import { Search, Trophy, Gamepad2, Dices, Send, ArrowUpRight, X } from 'lucide-react';
import { fetchGames } from '@/lib/games';
import type { Game } from '@/lib/types';
import { GameCard } from '@/components/GameCard';
import { useAuth } from '@/lib/auth';
import { linkHref } from '@/lib/router';

export function GamesPage() {
  const { profile } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [reelIndex, setReelIndex] = useState(0);
  const [reelFrame, setReelFrame] = useState(0);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [spinning, setSpinning] = useState(false);
  const spinTimeout = useRef<number | null>(null);

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

  useEffect(() => () => {
    if (spinTimeout.current !== null) window.clearTimeout(spinTimeout.current);
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
          <p className="mt-1 text-sm text-[var(--sr-text-muted)]" aria-live="polite">
            {query.trim()
              ? `Showing ${filtered.length} of ${games.length} games`
              : `${games.length} ${games.length === 1 ? 'game' : 'games'}`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-3">
          <button
            type="button"
            disabled={games.length === 0 || spinning}
            onClick={() => {
              if (spinTimeout.current !== null) window.clearTimeout(spinTimeout.current);
              const targetIndex = Math.floor(Math.random() * games.length);
              const startIndex = reelIndex % games.length;
              const totalSteps = 20 + Math.floor(Math.random() * 6);
              let step = 0;
              setSelectedGame(null);
              setSpinning(true);

              const advanceReel = () => {
                step += 1;
                const nextIndex = step === totalSteps
                  ? targetIndex
                  : (startIndex + step) % games.length;
                setReelIndex(nextIndex);
                setReelFrame((frame) => frame + 1);

                if (step === totalSteps) {
                  setSelectedGame(games[targetIndex] ?? null);
                  setSpinning(false);
                  spinTimeout.current = null;
                  return;
                }

                const progress = step / totalSteps;
                spinTimeout.current = window.setTimeout(
                  advanceReel,
                  35 + progress * progress * 230
                );
              };

              advanceReel();
            }}
            className="sr-btn-ghost min-w-0 flex-1 flex-shrink-0 sm:flex-none"
            title="Spin for a random game"
          >
            <Dices className={`h-4 w-4 ${spinning ? 'animate-bounce' : ''}`} />
            <span>{spinning ? 'Spinning…' : 'Random game'}</span>
          </button>
          <a href={linkHref('/request-game')} className="sr-btn-ghost min-w-0 flex-1 flex-shrink-0 sm:flex-none" title="Request a game">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Request game</span>
          </a>
          <div className="relative order-first w-full sm:order-none sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sr-text-muted)]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter games..."
              className={`sr-input ${query ? 'pl-9 pr-10' : 'pl-9'}`}
              aria-label="Filter games by title"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--sr-text-muted)] hover:bg-[var(--sr-surface-2)] hover:text-[var(--sr-text)]"
                aria-label="Clear game filter"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
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

      {(spinning || selectedGame) && (
        <section
          className="mb-6 overflow-hidden border border-[var(--sr-border)] bg-[var(--sr-surface)] p-4 sm:p-5"
          aria-live={spinning ? 'off' : 'polite'}
          aria-label={spinning ? 'Choosing a random game' : 'Random game selected'}
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative flex h-36 w-full max-w-56 items-center justify-center overflow-hidden border border-[var(--sr-border)] bg-[var(--sr-surface-2)] sm:h-32 sm:w-48">
              <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-8 bg-gradient-to-b from-[var(--sr-surface-2)] to-transparent" />
              <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-[var(--sr-surface-2)] to-transparent" />
              {(() => {
                const reelGame = selectedGame ?? games[reelIndex];
                return reelGame?.cover_url ? (
                  <img
                    key={`${reelFrame}-${reelGame.id}`}
                    src={reelGame.cover_url}
                    alt={spinning ? 'Game cover spinning' : `${reelGame.title} cover`}
                    className={`h-full w-full object-cover ${spinning ? 'animate-[slot-reel_180ms_ease-out]' : ''}`}
                  />
                ) : (
                  <Gamepad2 className={`h-12 w-12 text-[var(--sr-text-muted)] ${spinning ? 'animate-[slot-reel_180ms_ease-out]' : ''}`} />
                );
              })()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-start sm:text-left">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.15em] text-[var(--sr-primary)]">
                  {spinning ? 'Picking your next game' : 'Your random game'}
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--sr-text)]">
                  {spinning ? games[reelIndex]?.title : selectedGame?.title}
                </h2>
              </div>
              {selectedGame && !spinning && (
                <a
                  href={linkHref(`/games/${encodeURIComponent(selectedGame.slug)}`)}
                  className="sr-btn-primary"
                >
                  View game page
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </section>
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
        <div className="sr-panel flex flex-col items-center gap-3 p-8 text-center sm:p-12">
          <Trophy aria-hidden="true" className="h-10 w-10 text-[var(--sr-text-muted)]" />
          <div>
            <h2 className="font-semibold text-[var(--sr-text)]">
              {games.length === 0 ? 'No games yet' : 'No games match that search'}
            </h2>
            <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
              {games.length === 0
                ? 'Request a game and help grow the leaderboard.'
                : 'Try another title or clear your filter.'}
            </p>
          </div>
          {games.length === 0 ? (
            <a href={linkHref('/request-game')} className="sr-btn-primary">
              <Send aria-hidden="true" className="h-4 w-4" />
              Request a game
            </a>
          ) : (
            <button type="button" onClick={() => setQuery('')} className="sr-btn-ghost">
              Clear filter
            </button>
          )}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {filtered.map((g) => (
            <GameCard key={g.id} game={g} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
