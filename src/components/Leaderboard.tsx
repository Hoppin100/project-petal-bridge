import { useState, useMemo } from 'react';
import { Medal, ExternalLink, Search, X, BadgeCheck } from 'lucide-react';
import type { Run, Profile } from '@/lib/types';
import { formatTime, timeAgo } from '@/lib/format';
import { linkHref } from '@/lib/router';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth';
import { compareRunTimes } from '@/lib/game-rules';

interface LeaderboardProps {
  runs: Run[];
  runnerMap?: Record<string, Profile>;
  showVideo?: boolean;
  slowerIsBetter?: boolean;
}

function rankText(rank: number) {
  return rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
}

function rankColor(rank: number) {
  return rank === 1
    ? 'text-[var(--sr-gold)]'
    : rank === 2
      ? 'text-[var(--sr-silver)]'
      : rank === 3
        ? 'text-[var(--sr-bronze)]'
        : 'text-[var(--sr-text-muted)]';
}

export function Leaderboard({
  runs,
  runnerMap,
  showVideo = true,
  slowerIsBetter = false,
}: LeaderboardProps) {
  const [filter, setFilter] = useState('');
  const { profile } = useAuth();
  const sorted = useMemo(
    () =>
      runs
        .filter((run) => run.status === 'verified')
        .sort((a, b) => compareRunTimes(a.time_ms, b.time_ms, slowerIsBetter)),
    [runs, slowerIsBetter],
  );
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter((run) => (runnerMap?.[run.runner_id]?.username ?? '').toLowerCase().includes(query));
  }, [sorted, filter, runnerMap]);

  if (!sorted.length) return <div className="sr-panel flex flex-col items-center px-4 py-10 text-center"><Medal className="h-8 w-8 text-[var(--sr-primary)]" /><p className="mt-3 font-semibold text-[var(--sr-text)]">No verified runs yet</p><p className="mt-1 text-sm text-[var(--sr-text-muted)]">Submit the first run for this category.</p></div>;

  return <section aria-label="Verified leaderboard">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="relative w-full max-w-xs">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sr-text-muted)]" />
        <input type="search" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a runner" className="sr-input pl-9 pr-9" aria-label="Filter leaderboard by runner" />
        {filter && <button type="button" onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]" aria-label="Clear runner filter"><X className="h-4 w-4" /></button>}
      </div>
      <span className="sr-mono text-xs text-[var(--sr-text-muted)]">{filtered.length} of {sorted.length} verified {sorted.length === 1 ? 'run' : 'runs'}</span>
    </div>

    {filtered.length === 0 ? <p className="sr-panel py-8 text-center text-sm text-[var(--sr-text-muted)]">No runners match “{filter}”.</p> : (
      <>
        {/* Stacked rows on phones */}
        <ul className="divide-y divide-[var(--sr-border)] border border-[var(--sr-border)] bg-[var(--sr-surface)] sm:hidden" aria-label="Verified leaderboard list">
          {filtered.map((run, index) => {
            const runner = runnerMap?.[run.runner_id];
            const mine = Boolean(profile && profile.id === run.runner_id);
            const rank = index + 1;
            return (
              <li key={run.id} className={`flex items-center gap-3 px-3 py-3 ${mine ? 'bg-[var(--sr-surface-2)]' : ''}`}>
                <span className={`sr-mono w-9 flex-shrink-0 text-xs font-semibold ${rankColor(rank)}`}>{rank <= 3 && <Medal aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />}{rankText(rank)}</span>
                <div className="min-w-0 flex-1">
                  {runner ? (
                    <a href={linkHref(`/profile/${runner.username}`)} className="inline-flex max-w-full items-center gap-2 font-semibold text-[var(--sr-link)] hover:underline">
                      <Avatar name={runner.username} src={runner.avatar_url} className="h-6 w-6 text-[10px]" />
                      <span className="truncate">{runner.username}</span>
                      {mine && <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sr-primary)]">You</span>}
                    </a>
                  ) : <span className="text-sm text-[var(--sr-text-muted)]">Unknown runner</span>}
                  <p className="mt-0.5 truncate text-xs text-[var(--sr-text-muted)]">{run.platform} · {timeAgo(run.created_at)}</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className="sr-mono whitespace-nowrap text-sm font-semibold text-[var(--sr-text)]">{formatTime(run.time_ms)}{rank === 1 && <span className="ml-1 rounded-sm bg-[var(--sr-gold)]/15 px-1 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[var(--sr-gold)]" title="World record">WR</span>}<BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-[var(--sr-primary)]" aria-label="Verified" /></span>
                  {showVideo && <a href={run.video_url} target="_blank" rel="noopener noreferrer" className="p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]" aria-label={`Watch ${runner?.username ?? 'runner'}'s verified video`}><ExternalLink className="h-4 w-4" /></a>}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Full table on larger screens */}
        <div className="hidden overflow-x-auto rounded-sm border border-[var(--sr-border)] bg-[var(--sr-surface)] sm:block">
          <table className="w-full min-w-[540px] text-sm">
            <caption className="sr-only">Verified runs sorted by completion time</caption>
            <thead><tr className="border-b border-[var(--sr-border)] bg-[var(--sr-surface-2)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--sr-text-dim)]"><th scope="col" className="w-16 py-2.5 pl-3 pr-2">Rank</th><th scope="col" className="px-2 py-2.5">Runner</th><th scope="col" className="px-2 py-2.5">Time</th><th scope="col" className="hidden px-2 py-2.5 sm:table-cell">Platform</th><th scope="col" className="hidden px-2 py-2.5 md:table-cell">Submitted</th>{showVideo && <th scope="col" className="w-12 px-2 py-2.5 text-right">Video</th>}</tr></thead>
            <tbody>{filtered.map((run, index) => {
              const runner = runnerMap?.[run.runner_id];
              const mine = Boolean(profile && profile.id === run.runner_id);
              const rank = index + 1;
              return <tr key={run.id} className={`border-b border-[var(--sr-border)]/70 last:border-0 odd:bg-[var(--sr-bg-2)]/40 hover:bg-[var(--sr-surface-2)] ${mine ? 'bg-[var(--sr-surface)]/70' : ''} ${rank === 1 ? 'border-l-2 border-l-[var(--sr-gold)]' : rank === 2 ? 'border-l-2 border-l-[var(--sr-silver)]' : rank === 3 ? 'border-l-2 border-l-[var(--sr-bronze)]' : ''}`}>
                <td className="py-3 pl-3 pr-2"><span className={`sr-mono inline-flex min-w-7 items-center gap-1 text-xs font-semibold ${rankColor(rank)}`}>{rank <= 3 && <Medal aria-hidden="true" className="h-3.5 w-3.5" />}{rankText(rank)}</span></td>
                <td className="px-2 py-3">{runner ? <a href={linkHref(`/profile/${runner.username}`)} className="inline-flex items-center gap-2 font-semibold text-[var(--sr-link)] hover:underline"><Avatar name={runner.username} src={runner.avatar_url} className="h-7 w-7 text-[10px]" />{runner.username}{mine && <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sr-primary)]">You</span>}</a> : <span className="text-[var(--sr-text-muted)]">Unknown runner</span>}</td>
                <td className="sr-mono whitespace-nowrap px-2 py-3 font-semibold tabular-nums text-[var(--sr-text)]">{formatTime(run.time_ms)}{rank === 1 && <span className="ml-1.5 rounded-sm bg-[var(--sr-gold)]/15 px-1 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[var(--sr-gold)]" title="World record">WR</span>} <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-[var(--sr-primary)]" aria-label="Verified" /></td>
                <td className="hidden px-2 py-3 text-[var(--sr-text-dim)] sm:table-cell">{run.platform}</td>
                <td className="hidden px-2 py-3 text-xs text-[var(--sr-text-muted)] md:table-cell">{timeAgo(run.created_at)}</td>
                {showVideo && <td className="px-2 py-3 text-right"><a href={run.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]" aria-label={`Watch ${runner?.username ?? 'runner'}'s verified video`}><ExternalLink className="h-4 w-4" /></a></td>}
              </tr>;
            })}</tbody>
          </table>
        </div>
      </>
    )}
  </section>;
}
