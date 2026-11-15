import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Gamepad2, Trophy, Youtube, MessageSquare, Send } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchGames } from '@/lib/games';
import type { Category, Game, Profile, Run } from '@/lib/types';
import { GameCard } from '@/components/GameCard';
import { useAuth } from '@/lib/auth';
import { linkHref } from '@/lib/router';
import { formatTime, timeAgo } from '@/lib/format';
import { compareRunTimes, isSlowerIsBetterGame } from '@/lib/game-rules';

export function HomePage() {
  const { profile } = useAuth();
  const isOwner = profile?.role === 'owner';
  const [games, setGames] = useState<Game[]>([]);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [records, setRecords] = useState<Run[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [categories, setCategories] = useState<Record<string, Category>>({});
  const [verifiedCounts, setVerifiedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [gameResult, recentResult, recordsResult, activityResult] = await Promise.all([
        fetchGames(),
        supabase.from('runs').select('id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at').order('created_at', { ascending: false }).limit(8),
        supabase.from('runs').select('id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at').eq('status', 'verified').order('created_at', { ascending: false }).limit(1000),
        supabase.from('runs').select('id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at').eq('status', 'verified').order('created_at', { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      const gameList = gameResult.games;
      const recent = (recentResult.data as Run[]) ?? [];
      const verifiedRuns = (recordsResult.data as Run[]) ?? [];
      const verified = (activityResult.data as Run[]) ?? [];
      setGames(gameList);
      setRecentRuns(recent);
      const gamesById = new Map<string, Game>();
      for (const game of gameList) gamesById.set(game.id, game);
      const bestByCategory = new Map<string, Run>();
      for (const run of verifiedRuns) {
        const currentBest = bestByCategory.get(run.category_id);
        const slowerIsBetter = isSlowerIsBetterGame(
          gamesById.get(run.game_id) ?? { slug: '', title: '' },
          isOwner,
        );
        if (
          !currentBest ||
          compareRunTimes(run.time_ms, currentBest.time_ms, slowerIsBetter) < 0
        ) {
          bestByCategory.set(run.category_id, run);
        }
      }
      const topRecords = [...bestByCategory.values()].slice(0, 5);
      setRecords(topRecords);

      const counts: Record<string, number> = {};
      for (const run of verified) counts[run.game_id] = (counts[run.game_id] ?? 0) + 1;
      setVerifiedCounts(counts);

      const allRunsById = new Map<string, Run>();
      for (const run of [...recent, ...topRecords, ...verified]) allRunsById.set(run.id, run);
      const allRuns = [...allRunsById.values()];
      const runnerIds = [...new Set(allRuns.map((run) => run.runner_id))];
      const categoryIds = [...new Set(allRuns.map((run) => run.category_id))];
      const [profileData, categoryData] = await Promise.all([
        runnerIds.length ? supabase.from('profiles').select('id, username, role, bio, avatar_url, created_at').in('id', runnerIds).then(({ data }) => data as Profile[] | null) : Promise.resolve([] as Profile[]),
        categoryIds.length ? supabase.from('categories').select('id, game_id, name, timing_rules, sort_order, created_at').in('id', categoryIds).then(({ data }) => data as Category[] | null) : Promise.resolve([] as Category[]),
      ]);
      if (cancelled) return;
      const profileMap: Record<string, Profile> = {};
      for (const profile of profileData ?? []) profileMap[profile.id] = profile;
      const categoryMap: Record<string, Category> = {};
      for (const category of categoryData ?? []) categoryMap[category.id] = category;
      setProfiles(profileMap);
      setCategories(categoryMap);
      setLoadError(Boolean(gameResult.error || recentResult.error || recordsResult.error || activityResult.error));
      setLoading(false);
    })().catch(() => {
      if (!cancelled) { setLoadError(true); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [isOwner]);

  const gamesByActivity = useMemo(() => [...games].sort((a, b) =>
    (verifiedCounts[b.id] ?? 0) - (verifiedCounts[a.id] ?? 0) || a.title.localeCompare(b.title)
  ), [games, verifiedCounts]);
  const featuredGames = games.filter((game) => game.is_featured);
  const popularGames = gamesByActivity.slice(0, 4);

  const placeLabel = (rank: number) => rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
  const rankOf = (run: Run) => run.status === 'verified' ? records.findIndex((r) => r.id === run.id) + 1 : 0;

  return (
    <div className="sr-container pb-10">
      {/* Leaderboard-first hero: copy on the left, current records on the right */}
      <section className="grid gap-8 border-b border-[var(--sr-border)] py-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
        <div className="max-w-xl">
          <p className="sr-eyebrow flex items-center gap-2">
            <Trophy aria-hidden="true" className="h-4 w-4" />
            Community leaderboards
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            Every run counts.<br />
            <span className="text-[var(--sr-primary)]">Every split is checked.</span>
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--sr-text-dim)]">
            Pick a game, post your time with video proof, and get reviewed by the
            team. Verified runs go straight onto the board.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={linkHref('/games')} className="sr-btn-primary">
              Browse games
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
            <a href={linkHref('/submit')} className="sr-btn-ghost">Submit a run</a>
            {isOwner && (
              <a href={linkHref('/daily-challenge')} className="sr-btn-ghost">
                <Trophy aria-hidden="true" className="h-4 w-4" />
                Daily Challenge
              </a>
            )}
          </div>
          {!loading && games.length > 0 && (
            <p className="sr-mono mt-5 text-xs text-[var(--sr-text-muted)]">
              {games.length} {games.length === 1 ? 'game' : 'games'} tracked
              {featuredGames.length > 0 && <> · {featuredGames.length} featured</>}
            </p>
          )}
        </div>

        <aside aria-label="Current world records" className="min-w-0 border-l-2 border-[var(--sr-primary)] pl-4 lg:border-l lg:pl-0">
          <p className="sr-rule-title">Current records</p>
          {loading ? (
            <div className="py-4"><LoadingRows /></div>
          ) : records.length ? (
            <ul className="mt-2">
              {records.slice(0, 3).map((run) => {
                const game = games.find((item) => item.id === run.game_id);
                const runner = profiles[run.runner_id];
                return (
                  <li key={run.id} className="flex items-center gap-3 border-b border-[var(--sr-border)] py-3 last:border-0">
                    <GameArt game={game} small />
                    <div className="min-w-0 flex-1">
                      <a href={game ? linkHref(`/games/${game.slug}`) : linkHref('/games')} className="block truncate font-semibold text-[var(--sr-link)] hover:underline">{game?.title ?? 'Game'}</a>
                      <p className="truncate text-xs text-[var(--sr-text-muted)]">{categories[run.category_id]?.name ?? 'Category'} · {runner?.username ?? 'Runner'}</p>
                    </div>
                    <a href={run.video_url} target="_blank" rel="noopener noreferrer" className="sr-mono whitespace-nowrap font-semibold text-[var(--sr-text)] hover:text-[var(--sr-primary)]">{formatTime(run.time_ms)}</a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[var(--sr-text-muted)]">Records appear here once runs are verified.</p>
          )}
          <a href={linkHref('/games')} className="mt-3 inline-flex text-xs font-semibold text-[var(--sr-link)] hover:underline">All games and boards →</a>
        </aside>
      </section>

      {loadError && <p role="status" className="sr-panel mt-6 px-4 py-3 text-sm text-[var(--sr-text-dim)]">Some data could not be loaded. Try refreshing the page.</p>}

      {featuredGames.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center gap-3">
            <h2 className="sr-rule-title flex-1">Featured games</h2>
            <a href={linkHref('/games')} className="sr-link text-xs font-semibold">See all</a>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{featuredGames.slice(0, 6).map((game) => <GameCard key={game.id} game={game} />)}</div>
        </section>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0" aria-label="Latest runs">
          <h2 className="sr-rule-title">
            <span className="text-[var(--sr-text)]">Latest runs</span>
            <span className="text-xs font-medium normal-case tracking-normal text-[var(--sr-text-muted)]">New submissions and review decisions</span>
          </h2>
          <div className="mt-2">
            {loading ? <div className="py-3"><LoadingRows /></div> : recentRuns.length ? (
              <ul className="divide-y divide-[var(--sr-border)] border-y border-[var(--sr-border)]">
                {recentRuns.map((run) => {
                  const game = games.find((item) => item.id === run.game_id);
                  const runner = profiles[run.runner_id];
                  const category = categories[run.category_id];
                  const rank = rankOf(run);
                  return (
                    <li key={run.id} className="flex items-center gap-3 py-3">
                      <StatusDot status={run.status} />
                      <GameArt game={game} small />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">
                          <a href={game ? linkHref(`/games/${game.slug}`) : linkHref('/games')} className="font-semibold text-[var(--sr-text)] hover:text-[var(--sr-link)]">{game?.title ?? 'Game'}</a>
                          <span className="text-[var(--sr-text-muted)]"> — {category?.name ?? 'Category'}</span>
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[var(--sr-text-muted)]">
                          {runner ? <a href={linkHref(`/profile/${runner.username}`)} className="font-medium text-[var(--sr-link)] hover:underline">{runner.username}</a> : 'Runner'}
                          {' · '}{run.platform} · {timeAgo(run.created_at)}
                        </p>
                      </div>
                      <div className="whitespace-nowrap text-right">
                        <p className="sr-mono text-sm font-semibold text-[var(--sr-text)]">{formatTime(run.time_ms)}</p>
                        <p className="text-xs text-[var(--sr-text-muted)]">{run.status === 'verified' ? (rank ? placeLabel(rank) : 'Verified') : run.status === 'pending' ? 'In review' : 'Rejected'}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyLine text="No runs have been submitted yet." href="/games" />}
          </div>
        </section>

        <aside className="min-w-0 space-y-8">
          <section aria-label="Popular games">
            <h2 className="sr-rule-title">Popular games</h2>
            {loading ? <div className="py-4"><LoadingRows /></div> : popularGames.length ? (
              <ul className="mt-2 divide-y divide-[var(--sr-border)] border-y border-[var(--sr-border)]">
                {popularGames.map((game, index) => (
                  <li key={game.id}>
                    <a href={linkHref(`/games/${game.slug}`)} className="flex items-center gap-3 py-3">
                      <span className="sr-mono w-6 flex-shrink-0 text-right text-xs font-semibold text-[var(--sr-text-muted)]">{String(index + 1).padStart(2, '0')}</span>
                      <GameArt game={game} small />
                      <span className="min-w-0 flex-1 truncate font-semibold text-[var(--sr-link)] hover:underline">{game.title}</span>
                      <span className="text-right">
                        <span className="block sr-num text-base leading-5">{verifiedCounts[game.id] ?? 0}</span>
                        <span className="text-xs text-[var(--sr-text-muted)]">{(verifiedCounts[game.id] ?? 0) === 1 ? 'run' : 'runs'}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : <div className="mt-2"><EmptyLine text="Games show here once they are added." href="/games" /></div>}
          </section>

          <section aria-label="Community">
            <h2 className="sr-rule-title">Community</h2>
            <div className="mt-2 divide-y divide-[var(--sr-border)] border-y border-[var(--sr-border)]">
              <a href="https://discord.gg/JySJqfagAq" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3 group">
                <MessageSquare aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--sr-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--sr-text)] group-hover:text-[var(--sr-link)]">SplitRush Discord</span>
                  <span className="block text-xs text-[var(--sr-text-muted)]">Race announcements, routing, and off-topic</span>
                </span>
              </a>
              <a href="https://www.youtube.com/@SplitRushOffical" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3 group">
                <Youtube aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--sr-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--sr-text)] group-hover:text-[var(--sr-link)]">YouTube</span>
                  <span className="block text-xs text-[var(--sr-text-muted)]">Verified run highlights</span>
                </span>
              </a>
              <a href={linkHref('/request-game')} className="flex items-center gap-3 py-3 group">
                <Send aria-hidden="true" className="h-4 w-4 flex-shrink-0 text-[var(--sr-primary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--sr-text)] group-hover:text-[var(--sr-link)]">Request a game</span>
                  <span className="block text-xs text-[var(--sr-text-muted)]">Suggest the next leaderboard</span>
                </span>
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function EmptyLine({ text, href }: { text: string; href?: string }) {
  return <div className="py-5 text-sm text-[var(--sr-text-muted)]">{text}{href && <> <a className="sr-link" href={linkHref(href)}>Browse games</a></>}</div>;
}

function LoadingRows() {
  return <div className="space-y-2 py-3" aria-label="Loading"><div className="h-8 animate-pulse rounded-md bg-[var(--sr-surface-2)]" /><div className="h-8 animate-pulse rounded-md bg-[var(--sr-surface-2)]" /><div className="h-8 animate-pulse rounded-md bg-[var(--sr-surface-2)]" /></div>;
}

function StatusDot({ status }: { status: Run['status'] }) {
  const color = status === 'verified' ? 'var(--sr-primary)' : status === 'pending' ? 'var(--sr-warn)' : 'var(--sr-danger)';
  const label = status === 'verified' ? 'Verified run' : status === 'pending' ? 'Run pending review' : 'Rejected run';
  return <span aria-label={label} title={label} className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />;
}

function GameArt({ game, small = false }: { game: Game | undefined; small?: boolean }) {
  return <span className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--sr-surface-2)] text-[var(--sr-text-muted)] ${small ? 'h-12 w-9' : 'h-20 w-16'}`}>{game?.cover_url ? <img src={game.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" onError={(event) => event.currentTarget.remove()} /> : <Gamepad2 className="h-4 w-4" />}</span>;
}
