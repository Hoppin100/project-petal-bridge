import { useEffect, useState } from 'react';
import { Trophy, ArrowLeft, ExternalLink, Info, Gamepad2, Medal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchGameBySlug } from '@/lib/games';
import type { Game, Category, Run, Profile } from '@/lib/types';
import { Leaderboard } from '@/components/Leaderboard';
import { linkHref } from '@/lib/router';
import { formatTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';

interface GameDetailPageProps {
  slug: string;
}

export function GameDetailPage({ slug }: GameDetailPageProps) {
  const { profile, loading: authLoading } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runnerMap, setRunnerMap] = useState<Record<string, Profile>>({});
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [underConstruction, setUnderConstruction] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setUnderConstruction(false);
      setLoadError('');
      const { data: isUnderConstruction, error: visibilityError } = await supabase.rpc(
        'is_game_under_construction',
        { p_slug: slug }
      );
      if (cancelled) return;
      if (visibilityError) {
        const visibilityMigrationMissing =
          (visibilityError.code === 'PGRST202' || visibilityError.code === '42883') &&
          /is_game_under_construction/i.test(visibilityError.message);
        if (visibilityMigrationMissing) {
          console.warn('Game visibility migration is not applied; loading the public game page without hidden-game support.');
        } else {
          console.error('Could not check game visibility', visibilityError);
          setLoadError(visibilityError.message);
          setLoading(false);
          return;
        }
      }
      const isStaff = profile?.role === 'owner' || profile?.role === 'moderator';
      if (isUnderConstruction && !isStaff) {
        setUnderConstruction(true);
        setLoading(false);
        return;
      }
      const { game: g, error } = await fetchGameBySlug(slug);
      if (cancelled) return;
      if (error) {
        console.error('Could not load game', error);
        setLoadError(error);
        setLoading(false);
        return;
      }
      if (!g) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setGame(g as Game);

      const { data: cats } = await supabase
        .from('categories')
        .select('id, game_id, name, timing_rules, sort_order, created_at')
        .eq('game_id', g.id)
        .order('sort_order')
        .order('name');
      if (cancelled) return;
      const catList = (cats as Category[]) ?? [];
      setCategories(catList);
      if (catList.length > 0) setActiveCat(catList[0]!.id);

      setLoading(false);
    })().catch((error: unknown) => {
      if (cancelled) return;
      console.error('Could not load game page', error);
      setLoadError('The game library could not be reached. Check the Supabase connection and try again.');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug, authLoading, profile?.role]);

  useEffect(() => {
    if (!activeCat) return;
    (async () => {
      const { data: r } = await supabase
        .from('runs')
        .select(
          'id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at'
        )
        .eq('category_id', activeCat)
        .eq('status', 'verified')
        .order('time_ms', { ascending: true })
        .limit(100);
      const runList = (r as Run[]) ?? [];
      setRuns(runList);

      const ids = [...new Set(runList.map((x) => x.runner_id))];
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, role, bio, avatar_url, created_at')
          .in('id', ids);
        const map: Record<string, Profile> = {};
        for (const p of (profs as Profile[]) ?? []) {
          map[p.id] = p;
        }
        setRunnerMap(map);
      } else {
        setRunnerMap({});
      }
    })();
  }, [activeCat]);

  if (loading || authLoading) {
    return (
      <div className="sr-container py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--sr-primary)] border-t-transparent" />
      </div>
    );
  }

  if (underConstruction) {
    return (
      <div className="sr-container py-20 text-center">
        <Gamepad2 className="mx-auto h-12 w-12 text-emerald-800" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-50">
          This page is under construction
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--sr-text-muted)]">
          This game page is not available to the public yet.
        </p>
        <a href={linkHref('/games')} className="sr-btn-ghost mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to games
        </a>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="sr-container py-16 text-center">
        <h1 className="text-2xl font-bold">Game data unavailable</h1>
        <p role="alert" className="mx-auto mt-2 max-w-xl text-sm text-[var(--sr-text-muted)]">
          The game library could not be reached. Check the Supabase connection and try again.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="sr-btn-ghost mt-5">Retry</button>
      </div>
    );
  }

  if (notFound || !game) {
    return (
      <div className="sr-container py-20 text-center">
        <Trophy className="mx-auto h-12 w-12 text-emerald-800" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-50">Game not found</h1>
        <a href={linkHref('/games')} className="sr-btn-ghost mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to games
        </a>
      </div>
    );
  }

  const activeCategory = categories.find((c) => c.id === activeCat);
  const worldRecord = runs[0]; // sorted ascending

  return (
    <div className="sr-container pb-12">
      <section className="sr-panel my-6 p-4 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <a
            href={linkHref('/games')}
            className="inline-flex items-center gap-1 text-sm text-[var(--sr-text-muted)] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All games
          </a>

          <span className="text-xs text-[var(--sr-text-muted)]">{game.source || 'Game leaderboard'}</span>
        </div>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-36 w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-sm border border-[var(--sr-border)] bg-[var(--sr-surface-2)] text-[var(--sr-text-muted)] sm:h-40 sm:w-56">
              {game.cover_url ? (
                <img
                  src={game.cover_url}
                  alt={game.title}
                  className="h-full w-full object-cover"
                  onError={(event) => event.currentTarget.remove()}
                />
              ) : <Gamepad2 className="h-7 w-7" />}
            </div>
            <div className="min-w-0 flex-1">
              {game.is_featured && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--sr-primary)]">Featured leaderboard</p>}
              <h1 className="text-2xl font-bold sm:text-4xl">
                {game.title}
              </h1>
              {game.blurb && (
                <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--sr-text-dim)]">
                  {game.blurb}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href={linkHref('/submit')}
                  className="sr-btn-primary"
                >
                  Submit a run
                </a>
                {game.page_url && (
                  <a
                    href={game.page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sr-btn-ghost"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Game page
                  </a>
                )}
                {worldRecord && (
                  <div className="flex items-center gap-2 border-l border-[var(--sr-border)] pl-3">
                    <Medal className="h-4 w-4 text-[var(--sr-primary)]" />
                    <span className="text-xs text-[var(--sr-text-muted)]">Record</span>
                    <span className="sr-mono font-semibold text-white">
                      {formatTime(worldRecord.time_ms)}
                    </span>
                  </div>
                )}
              </div>
            </div>
        </div>
      </section>

      <section className="sr-panel p-4 sm:p-5">
        {categories.length === 0 ? (
          <div className="py-8 text-center">
            <Medal className="mx-auto h-8 w-8 text-[var(--sr-text-muted)]" />
            <p className="mt-3 font-semibold text-[var(--sr-text)]">No categories yet</p>
            <p className="mt-1 text-sm text-[var(--sr-text-muted)]">Leaderboards will appear here when categories are added.</p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--sr-border)]" role="tablist" aria-label="Leaderboard category">
              {categories.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={activeCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                  className={`flex-shrink-0 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    activeCat === c.id
                      ? 'border-[var(--sr-primary)] text-white'
                      : 'border-transparent text-[var(--sr-text-muted)] hover:text-white'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {activeCategory?.timing_rules && (
              <div className="mb-5 flex items-start gap-2 border-l-2 border-[var(--sr-border-hover)] bg-[var(--sr-surface)] px-3 py-2.5 text-sm text-[var(--sr-text-dim)]">
                <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--sr-primary)]" />
                <div>
                  <span className="font-semibold text-white">
                    Timing rules:
                  </span>{' '}
                  {activeCategory.timing_rules}
                </div>
              </div>
            )}

            <Leaderboard runs={runs} runnerMap={runnerMap} />
          </>
        )}
      </section>
    </div>
  );
}
