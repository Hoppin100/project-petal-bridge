import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Trophy, Clock, ExternalLink, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Run, Game, Category } from '@/lib/types';
import { formatTime, timeAgo } from '@/lib/format';
import { linkHref } from '@/lib/router';
import { Avatar } from '@/components/Avatar';
import { compareRunTimes, isSlowerIsBetterGame } from '@/lib/game-rules';

interface ProfilePageProps {
  username: string;
}

export function ProfilePage({ username }: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [gameMap, setGameMap] = useState<Record<string, Game>>({});
  const [catMap, setCatMap] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let current = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setLoadError(false);
      const { data: p, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, role, bio, avatar_url, created_at')
        .ilike('username', username.replace(/[\\%_]/g, '\\$&'))
        .maybeSingle();
      if (!current) return;
      if (profileError) throw profileError;
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(p as Profile);

      const { data: r, error: runsError } = await supabase
        .from('runs')
        .select(
          'id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at'
        )
        .eq('runner_id', p.id)
        .order('created_at', { ascending: false });
      if (runsError) throw runsError;
      if (!current) return;
      const runList = (r as Run[]) ?? [];
      setRuns(runList);

      const gIds = [...new Set(runList.map((x) => x.game_id))];
      const cIds = [...new Set(runList.map((x) => x.category_id))];
      if (gIds.length) {
        const { data: gs } = await supabase
          .from('games')
          .select('id, slug, title, cover_url, blurb, is_featured, created_at')
          .in('id', gIds);
        const gm: Record<string, Game> = {};
        for (const g of (gs as Game[]) ?? []) gm[g.id] = g;
        setGameMap(gm);
      }
      if (cIds.length) {
        const { data: cs } = await supabase
          .from('categories')
          .select('id, game_id, name, timing_rules, sort_order, created_at')
          .in('id', cIds);
        const cm: Record<string, Category> = {};
        for (const c of (cs as Category[]) ?? []) cm[c.id] = c;
        setCatMap(cm);
      }
      setLoading(false);
    })().catch((error) => {
      console.error('profile load failed', error);
      if (current) { setLoadError(true); setLoading(false); }
    });
    return () => { current = false; };
  }, [username]);

  const verifiedRuns = useMemo(() => runs.filter((r) => r.status === 'verified'), [runs]);
  const pendingRuns = useMemo(() => runs.filter((r) => r.status === 'pending'), [runs]);
  const rejectedRuns = useMemo(() => runs.filter((r) => r.status === 'rejected'), [runs]);

  // Best verified time per game + category, computed from the runs already loaded.
  const personalBests = useMemo(() => {
    const isOwner = profile?.role === 'owner';
    const best = new Map<string, { run: Run; game: Game | undefined; cat: Category | undefined }>();
    for (const run of verifiedRuns) {
      const game = gameMap[run.game_id];
      const slowerIsBetter = isOwner && game ? isSlowerIsBetterGame(game, true) : false;
      const key = `${run.game_id}:${run.category_id}`;
      const current = best.get(key);
      if (!current || compareRunTimes(run.time_ms, current.run.time_ms, slowerIsBetter) < 0) {
        best.set(key, { run, game, cat: catMap[run.category_id] });
      }
    }
    return [...best.values()];
  }, [verifiedRuns, gameMap, catMap, profile?.role]);

  const gamesPlayed = useMemo(
    () => new Set(verifiedRuns.map((run) => run.game_id)).size,
    [verifiedRuns],
  );

  if (loading) {
    return (
      <div className="sr-container py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--sr-primary)] border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return <div className="sr-container py-20 text-center"><h1 className="text-2xl font-bold">Profile unavailable</h1><p className="mt-2 text-sm text-[var(--sr-text-muted)]">This runner could not be loaded right now.</p><button className="sr-btn-ghost mt-5" onClick={() => window.location.reload()}>Retry</button></div>;
  }

  if (notFound || !profile) {
    return (
      <div className="sr-container py-20 text-center">
        <Trophy className="mx-auto h-12 w-12 text-[var(--sr-text-muted)]" />
        <h1 className="mt-4 text-2xl font-bold text-[var(--sr-text)]">
          Runner not found
        </h1>
        <a href={linkHref('/games')} className="sr-btn-ghost mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to games
        </a>
      </div>
    );
  }

  const p = profile;

  return (
    <div className="sr-container py-8 sm:py-10">
      <a
        href={linkHref('/')}
        className="mb-5 inline-flex items-center gap-1 text-sm text-[var(--sr-text-muted)] transition-colors hover:text-[var(--sr-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </a>

      {/* Profile header */}
      <section className="flex flex-col gap-5 border-b border-[var(--sr-border)] pb-8 sm:flex-row sm:items-center">
        <Avatar name={p.username} src={p.avatar_url} className="h-20 w-20 text-2xl sm:h-24 sm:w-24" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-[var(--sr-text)] sm:text-3xl">
              {p.username}
            </h1>
            {p.role === 'owner' && (
              <span className="sr-badge bg-[var(--sr-primary)] text-[#06110a]">
                Owner
              </span>
            )}
            {p.role === 'moderator' && (
              <span className="sr-badge bg-[var(--sr-surface-2)] text-[var(--sr-primary)]">
                Moderator
              </span>
            )}
          </div>
          {p.bio && (
            <p className="mt-1 max-w-xl text-sm text-[var(--sr-text-dim)]">{p.bio}</p>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-[var(--sr-text-muted)]">
            <Calendar className="h-3 w-3" />
            Joined {timeAgo(p.created_at)}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 border-t border-[var(--sr-border)] pt-4 text-center sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <div className="px-3">
            <dt className="sr-stat-label">Verified</dt>
            <dd className="sr-stat-value">{verifiedRuns.length}</dd>
          </div>
          <div className="border-l border-[var(--sr-border)] px-3">
            <dt className="sr-stat-label">In review</dt>
            <dd className="sr-stat-value">{pendingRuns.length}</dd>
          </div>
          <div className="border-l border-[var(--sr-border)] px-3">
            <dt className="sr-stat-label">Games</dt>
            <dd className="sr-stat-value">{gamesPlayed}</dd>
          </div>
        </dl>
      </section>

      {/* Personal bests */}
      <section className="mt-8" aria-labelledby="personal-bests-heading">
        <h2 id="personal-bests-heading" className="sr-rule-title">Personal bests</h2>
        {personalBests.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--sr-text-muted)]">
            No verified records yet. Best times show up here after a run is reviewed.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--sr-border)] border-y border-[var(--sr-border)]">
            {personalBests.map(({ run, game, cat }) => (
              <li key={run.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {game
                      ? <a href={linkHref(`/games/${game.slug}`)} className="font-semibold text-[var(--sr-text)] hover:text-[var(--sr-link)]">{game.title}</a>
                      : <span className="font-semibold text-[var(--sr-text)]">Game</span>}
                    <span className="text-[var(--sr-text-muted)]"> — {cat?.name ?? 'Category'}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">{run.platform} · {timeAgo(run.created_at)}</p>
                </div>
                <span className="sr-mono whitespace-nowrap text-sm font-semibold text-[var(--sr-text)]">
                  {formatTime(run.time_ms)}
                </span>
                <a
                  href={run.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
                  aria-label="Watch run video"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Run history */}
      <section className="mt-8" aria-labelledby="run-history-heading">
        <h2 id="run-history-heading" className="sr-rule-title">Run history</h2>
        {runs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--sr-text-muted)]">No runs submitted yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[var(--sr-border)] border-y border-[var(--sr-border)]">
            {runs.map((run) => {
              const game = gameMap[run.game_id];
              const cat = catMap[run.category_id];
              const statusBadge = {
                verified: 'sr-badge-ok',
                pending: 'sr-badge-pending',
                rejected: 'sr-badge-rejected',
              }[run.status];

              return (
                <li
                  key={run.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {game && (
                        <a
                          href={linkHref(`/games/${game.slug}`)}
                          className="font-semibold text-[var(--sr-text)] hover:text-[var(--sr-link)]"
                        >
                          {game.title}
                        </a>
                      )}
                      {cat && (
                        <span className="text-sm text-[var(--sr-text-muted)]">
                          — {cat.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="sr-mono flex items-center gap-1 text-[var(--sr-text)]">
                        <Clock className="h-3 w-3 text-[var(--sr-primary)]" />
                        {formatTime(run.time_ms)}
                      </span>
                      <span className="text-[var(--sr-text-dim)]">{run.platform}</span>
                      <span className="text-xs text-[var(--sr-text-muted)]">
                        {timeAgo(run.created_at)}
                      </span>
                    </div>
                    {run.status === 'rejected' && run.rejection_reason && (
                      <p className="mt-1 text-xs text-[var(--sr-danger)]">
                        Rejected: {run.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    <span className={`sr-badge capitalize ${statusBadge}`}>
                      {run.status}
                    </span>
                    <a
                      href={run.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
                      aria-label="Watch run"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {rejectedRuns.length > 0 && (
          <p className="mt-3 text-xs text-[var(--sr-text-muted)]">
            Rejected runs are kept for your records but do not appear on leaderboards.
          </p>
        )}
      </section>
    </div>
  );
}
