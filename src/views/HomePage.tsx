import { useEffect, useMemo, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchGames } from '@/lib/games';
import type { Category, Game, Profile, Run } from '@/lib/types';
import { GameCard } from '@/components/GameCard';
import { linkHref } from '@/lib/router';
import { formatTime, timeAgo } from '@/lib/format';

export function HomePage() {
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
        supabase.from('runs').select('id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at').eq('status', 'verified').order('time_ms', { ascending: true }).limit(100),
        supabase.from('runs').select('id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at').eq('status', 'verified').order('created_at', { ascending: false }).limit(100),
      ]);
      if (cancelled) return;
      const gameList = gameResult.games;
      const recent = (recentResult.data as Run[]) ?? [];
      const fastest = (recordsResult.data as Run[]) ?? [];
      const verified = (activityResult.data as Run[]) ?? [];
      setGames(gameList);
      setRecentRuns(recent);
      const bestByCategory = new Map<string, Run>();
      for (const run of fastest) {
        if (!bestByCategory.has(run.category_id)) bestByCategory.set(run.category_id, run);
      }
      setRecords([...bestByCategory.values()].slice(0, 5));

      const counts: Record<string, number> = {};
      for (const run of verified) counts[run.game_id] = (counts[run.game_id] ?? 0) + 1;
      setVerifiedCounts(counts);

      const allRunsById = new Map<string, Run>();
      for (const run of [...recent, ...fastest, ...verified]) allRunsById.set(run.id, run);
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
  }, []);

  const gamesByActivity = useMemo(() => [...games].sort((a, b) =>
    (verifiedCounts[b.id] ?? 0) - (verifiedCounts[a.id] ?? 0) || a.title.localeCompare(b.title)
  ), [games, verifiedCounts]);
  const featuredGames = games.filter((game) => game.is_featured);
  const popularGames = gamesByActivity.slice(0, 4);

  const placeLabel = (rank: number) => rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
  const rankOf = (run: Run) => run.status === 'verified' ? records.findIndex((r) => r.id === run.id) + 1 : 0;

  return (
    <div className="sr-container grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_400px]">
      {loadError && <p role="status" className="sr-panel px-4 py-3 text-sm text-[var(--sr-text-dim)] lg:col-span-2">Some data could not be loaded. Try refreshing the page.</p>}

      <section className="sr-panel min-w-0">
        <h2 className="sr-panel-title">Latest runs</h2>
        <div className="space-y-5 px-4 pb-4">
          {loading ? <LoadingRows /> : recentRuns.length ? recentRuns.map((run) => {
            const game = games.find((item) => item.id === run.game_id);
            const runner = profiles[run.runner_id];
            const category = categories[run.category_id];
            const rank = rankOf(run);
            return <article key={run.id} className="flex gap-4">
              <a href={game ? linkHref(`/games/${game.slug}`) : linkHref('/games')} className="flex-shrink-0"><GameArt game={game} /></a>
              <div className="min-w-0 flex-1">
                <a href={game ? linkHref(`/games/${game.slug}`) : linkHref('/games')} className="font-bold text-[var(--sr-text)] hover:underline">{game?.title ?? 'Game'}</a>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_120px_160px] gap-3 rounded border border-[var(--sr-border)] bg-[var(--sr-bg-2)] px-3 py-2.5 text-sm">
                  <div className="min-w-0"><span className="font-semibold text-[var(--sr-link)]">{category?.name ?? 'Category'}</span><p className="mt-1 truncate text-xs text-[var(--sr-text-muted)]">{run.platform}</p></div>
                  <div><p className="font-semibold text-[var(--sr-text)]">{run.status === 'verified' ? (rank ? placeLabel(rank) : 'Verified') : run.status === 'pending' ? 'Pending' : 'Rejected'}</p><p className="mt-0.5 tabular-nums text-[var(--sr-text-dim)]">{formatTime(run.time_ms)}</p></div>
                  <div className="min-w-0">{runner ? <a href={linkHref(`/profile/${runner.username}`)} className="block truncate font-semibold text-[var(--sr-link)] hover:underline">{runner.username}</a> : <span className="text-[var(--sr-text-muted)]">Runner</span>}<p className="mt-0.5 text-[var(--sr-text-dim)]">{timeAgo(run.created_at)}</p></div>
                </div>
              </div>
            </article>;
          }) : <EmptyLine text="No runs have been submitted yet." href="/games" />}
        </div>
      </section>

      <aside className="min-w-0 space-y-4">
        <section className="sr-panel">
          <h2 className="sr-panel-title">World records <a href={linkHref('/games')} className="text-xs font-semibold normal-case text-[var(--sr-link)] hover:underline">All games</a></h2>
          {loading ? <div className="px-4"><LoadingRows /></div> : records.length ? <ul>{records.map((run) => {
            const game = games.find((item) => item.id === run.game_id);
            const runner = profiles[run.runner_id];
            return <li key={run.id} className="flex items-center gap-3 px-4 py-2.5 odd:bg-[var(--sr-surface-2)]"><GameArt game={game} small /><div className="min-w-0 flex-1"><a href={game ? linkHref(`/games/${game.slug}`) : linkHref('/games')} className="block truncate font-semibold text-[var(--sr-link)] hover:underline">{game?.title ?? 'Game'}</a><p className="truncate text-xs text-[var(--sr-text-muted)]">{categories[run.category_id]?.name ?? 'Category'} · {runner?.username ?? 'Runner'}</p></div><a href={run.video_url} target="_blank" rel="noopener noreferrer" className="text-right font-semibold tabular-nums text-[var(--sr-text)] hover:underline">{formatTime(run.time_ms)}</a></li>;
          })}</ul> : <div className="px-4"><EmptyLine text="Records appear here once runs are verified." /></div>}
        </section>

        <section className="sr-panel">
          <h2 className="sr-panel-title">Popular games <a href={linkHref('/games')} className="text-xs font-semibold normal-case text-[var(--sr-link)] hover:underline">See all</a></h2>
          {loading ? <div className="px-4"><LoadingRows /></div> : popularGames.length ? <ul>{popularGames.map((game) => <li key={game.id} className="odd:bg-[var(--sr-surface-2)]"><a href={linkHref(`/games/${game.slug}`)} className="flex items-center gap-3 px-4 py-2.5"><GameArt game={game} small /><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-[var(--sr-link)] hover:underline">{game.title}</span>{game.is_featured && <span className="text-xs text-[var(--sr-text-muted)]">Featured</span>}</span><span className="text-center"><span className="block font-bold text-[var(--sr-text)]">{verifiedCounts[game.id] ?? 0}</span><span className="text-xs text-[var(--sr-text-muted)]">Runs</span></span></a></li>)}</ul> : <div className="px-4"><EmptyLine text="Games show here once they are added." /></div>}
        </section>

        {featuredGames.length > 0 && <section className="sr-panel">
          <h2 className="sr-panel-title">Featured</h2>
          <div className="grid grid-cols-3 gap-3 px-4 pb-4">{featuredGames.slice(0, 6).map((game) => <GameCard key={game.id} game={game} />)}</div>
        </section>}
      </aside>
    </div>
  );
}

function EmptyLine({ text, href }: { text: string; href?: string }) {
  return <div className="py-5 text-sm text-[var(--sr-text-muted)]">{text}{href && <> <a className="sr-link" href={linkHref(href)}>Browse games</a></>}</div>;
}

function LoadingRows() {
  return <div className="space-y-2 py-3" aria-label="Loading"><div className="h-8 animate-pulse rounded bg-[var(--sr-surface-2)]" /><div className="h-8 animate-pulse rounded bg-[var(--sr-surface-2)]" /><div className="h-8 animate-pulse rounded bg-[var(--sr-surface-2)]" /></div>;
}

function GameArt({ game, small = false }: { game: Game | undefined; small?: boolean }) {
  return <span className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--sr-surface-2)] text-[var(--sr-text-muted)] ${small ? 'h-12 w-9' : 'h-20 w-16'}`}>{game?.cover_url ? <img src={game.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" onError={(event) => event.currentTarget.remove()} /> : <Gamepad2 className="h-4 w-4" />}</span>;
}
