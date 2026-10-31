import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, ExternalLink, Gamepad2, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchGames } from '@/lib/games';
import type { Category, Game, Profile, Run } from '@/lib/types';
import { GameCard } from '@/components/GameCard';
import { SearchBar } from '@/components/SearchBar';
import { Avatar } from '@/components/Avatar';
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

  return (
    <div className="sr-container pb-12">
      <section className="grid gap-6 border-b border-[var(--sr-border)] py-7 md:grid-cols-[1fr_minmax(250px,360px)] md:items-end">
        <div>
          <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--sr-primary)]"><span className="h-2 w-2 rounded-full bg-[var(--sr-primary)]" />Speedrun leaderboards</p>
          <h1 className="text-3xl font-bold sm:text-4xl">The next split starts here.</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--sr-text-dim)]">Browse game records, follow the runners setting them, and put your own time on the board.</p>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]"><Search className="h-3.5 w-3.5" />Find a game</label>
          <SearchBar />
        </div>
      </section>

      {loadError && <p role="status" className="mt-4 border-l-2 border-amber-500 px-3 py-2 text-sm text-amber-200">Some data could not be loaded. Try refreshing the page.</p>}

      <div className="grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          <section>
            <SectionHeading eyebrow="Fastest verified times" title="Record board" href="/games" action="Browse leaderboards" />
            {loading ? <LoadingRows /> : records.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead><tr className="border-b border-[var(--sr-border)] text-[11px] uppercase tracking-wider text-[var(--sr-text-muted)]"><th className="w-12 py-2.5 pr-3">#</th><th className="py-2.5 pr-3">Game / category</th><th className="py-2.5 pr-3">Runner</th><th className="py-2.5 pr-3">Time</th><th className="py-2.5">Proof</th></tr></thead>
                  <tbody>{records.map((run, index) => {
                    const game = games.find((item) => item.id === run.game_id);
                    const runner = profiles[run.runner_id];
                    const category = categories[run.category_id];
                    return <tr key={run.id} className="border-b border-[var(--sr-border)]/70 hover:bg-[var(--sr-surface)]">
                      <td className="py-3 pr-3 font-mono text-[var(--sr-text-muted)]">{String(index + 1).padStart(2, '0')}</td>
                      <td className="py-3 pr-3"><a className="font-semibold text-[var(--sr-text)] hover:text-[var(--sr-primary)]" href={game ? linkHref(`/games/${game.slug}`) : linkHref('/games')}>{game?.title ?? 'Game'}</a><span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">{category?.name ?? 'Category'}</span></td>
                      <td className="py-3 pr-3">{runner ? <a href={linkHref(`/profile/${runner.username}`)} className="flex items-center gap-2 text-[var(--sr-text-dim)] hover:text-white"><Avatar name={runner.username} src={runner.avatar_url} className="h-6 w-6 text-[10px]" />{runner.username}</a> : <span className="text-[var(--sr-text-muted)]">Runner</span>}</td>
                      <td className="sr-mono py-3 pr-3 font-semibold text-white">{formatTime(run.time_ms)}</td>
                      <td className="py-3"><a href={run.video_url} target="_blank" rel="noopener noreferrer" aria-label={`Watch ${runner?.username ?? 'runner'}'s proof`} className="inline-flex text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"><ExternalLink className="h-4 w-4" /></a></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            ) : <EmptyLine text="Verified times will appear here as runs are reviewed." />}
          </section>

          <section>
            <SectionHeading eyebrow="Browse the library" title="Featured games" href="/games" action="All games" />
            {loading ? <LoadingRows /> : featuredGames.length ? <div className="grid gap-3 sm:grid-cols-2">{featuredGames.slice(0, 4).map((game) => <GameCard key={game.id} game={game} runCount={verifiedCounts[game.id] ?? 0} />)}</div> : <EmptyLine text="No featured games yet. Browse the full library instead." href="/games" />}
          </section>
        </div>

        <aside className="min-w-0 space-y-9">
          <section>
            <SectionHeading eyebrow="Latest 100 verified runs" title="Popular games" href="/games" action="See all" />
            {loading ? <LoadingRows /> : popularGames.length ? <ol className="divide-y divide-[var(--sr-border)]">{popularGames.map((game, index) => <li key={game.id} className="flex items-center gap-3 py-2.5"><span className="sr-mono w-5 text-xs text-[var(--sr-text-muted)]">{String(index + 1).padStart(2, '0')}</span><a href={linkHref(`/games/${game.slug}`)} className="flex min-w-0 flex-1 items-center gap-3"><GameArt game={game} /><span className="min-w-0"><span className="block truncate font-semibold text-[var(--sr-text)] hover:text-[var(--sr-primary)]">{game.title}</span><span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">{verifiedCounts[game.id] ?? 0} of those runs</span></span><ArrowUpRight className="h-4 w-4 text-[var(--sr-text-muted)]" /></a></li>)}</ol> : <EmptyLine text="Games will show here once they are added." />}
          </section>

          <section>
            <SectionHeading eyebrow="Latest submissions" title="Recent activity" />
            {loading ? <LoadingRows /> : recentRuns.length ? <ol className="divide-y divide-[var(--sr-border)]">{recentRuns.slice(0, 6).map((run) => {
              const game = games.find((item) => item.id === run.game_id);
              const runner = profiles[run.runner_id];
              return <li key={run.id} className="flex gap-3 py-3"><span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${run.status === 'verified' ? 'bg-emerald-400' : run.status === 'pending' ? 'bg-amber-400' : 'bg-red-400'}`} aria-hidden="true" /><div className="min-w-0"><p className="text-sm leading-5 text-[var(--sr-text-dim)]">{runner ? <a href={linkHref(`/profile/${runner.username}`)} className="font-semibold text-[var(--sr-text)] hover:text-[var(--sr-primary)]">{runner.username}</a> : <span className="font-semibold text-[var(--sr-text)]">A runner</span>} submitted a run for <a href={game ? linkHref(`/games/${game.slug}`) : linkHref('/games')} className="font-semibold text-[var(--sr-text)] hover:text-[var(--sr-primary)]">{game?.title ?? 'a game'}</a></p><p className="mt-1 text-xs capitalize text-[var(--sr-text-muted)]">{run.status} <span aria-hidden="true">·</span> {timeAgo(run.created_at)}</p></div></li>;
            })}</ol> : <EmptyLine text="New submissions will appear here." />}
          </section>

          <div className="border-t border-[var(--sr-border)] pt-4 text-xs leading-5 text-[var(--sr-text-muted)]"><ShieldCheck className="mb-2 h-4 w-4 text-[var(--sr-primary)]" />Runs are reviewed before verified times appear on leaderboards.</div>
        </aside>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, href, action }: { eyebrow: string; title: string; href?: string; action?: string }) {
  return <div className="mb-2 flex items-end justify-between gap-3 border-b border-[var(--sr-border)] pb-2"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--sr-text-muted)]">{eyebrow}</p><h2 className="mt-0.5 text-lg font-bold">{title}</h2></div>{href && <a href={linkHref(href)} className="flex-shrink-0 text-xs font-semibold text-[var(--sr-primary)] hover:text-white">{action ?? 'View all'} <span aria-hidden="true">→</span></a>}</div>;
}

function EmptyLine({ text, href }: { text: string; href?: string }) {
  return <div className="py-5 text-sm text-[var(--sr-text-muted)]">{text}{href && <> <a className="sr-link" href={linkHref(href)}>Browse games</a></>}</div>;
}

function LoadingRows() {
  return <div className="space-y-2 py-3" aria-label="Loading"><div className="h-8 animate-pulse bg-[var(--sr-surface)]" /><div className="h-8 animate-pulse bg-[var(--sr-surface)]" /><div className="h-8 animate-pulse bg-[var(--sr-surface)]" /></div>;
}

function GameArt({ game }: { game: Game }) {
  return <span className="flex h-10 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--sr-surface-2)] text-[10px] text-[var(--sr-text-muted)]">{game.cover_url ? <img src={game.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" onError={(event) => event.currentTarget.remove()} /> : <Gamepad2 className="h-4 w-4" />}</span>;
}
