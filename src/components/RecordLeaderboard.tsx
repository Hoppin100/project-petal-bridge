import { useMemo, useState } from 'react';
import { Medal, ExternalLink, Search, X, BadgeCheck, History } from 'lucide-react';
import type { Category, Profile, RecordSubmission } from '@/lib/types';
import { formatRecordValue, rankRecordSubmissions } from '@/lib/competitions';
import { timeAgo } from '@/lib/format';
import { linkHref } from '@/lib/router';
import { Avatar } from '@/components/Avatar';
import { useAuth } from '@/lib/auth';

interface RecordLeaderboardProps {
  submissions: RecordSubmission[];
  competition: Category;
  submitterMap?: Record<string, Profile>;
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

function achievedDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * One leaderboard per record competition. Only approved submissions are ranked;
 * pending and rejected values never show up as official records.
 */
export function RecordLeaderboard({
  submissions,
  competition,
  submitterMap,
}: RecordLeaderboardProps) {
  const [filter, setFilter] = useState('');
  const { profile } = useAuth();
  const unit = competition.record_unit ?? '';
  const higherIsBetter = competition.record_higher_is_better;

  const ranked = useMemo(
    () => rankRecordSubmissions(submissions, higherIsBetter),
    [submissions, higherIsBetter],
  );
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return ranked;
    return ranked.filter((entry) =>
      (submitterMap?.[entry.submitter_id]?.username ?? '').toLowerCase().includes(query),
    );
  }, [ranked, filter, submitterMap]);

  if (!ranked.length) {
    return (
      <div className="sr-panel flex flex-col items-center px-4 py-10 text-center">
        <Medal className="h-8 w-8 text-[var(--sr-primary)]" />
        <p className="mt-3 font-semibold text-[var(--sr-text)]">No verified records yet</p>
        <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
          Submit the first record for this competition.
        </p>
      </div>
    );
  }

  const history = ranked.slice(1);

  return (
    <section aria-label={`Verified ${competition.name} records`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sr-text-muted)]"
          />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Find a player"
            className="sr-input pl-9 pr-9"
            aria-label="Filter record leaderboard by player"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]"
              aria-label="Clear player filter"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <span className="sr-mono text-xs text-[var(--sr-text-muted)]">
          {filtered.length} of {ranked.length} verified {ranked.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="sr-panel py-8 text-center text-sm text-[var(--sr-text-muted)]">
          No players match “{filter}”.
        </p>
      ) : (
        <>
          {/* Stacked rows on phones */}
          <ul
            className="divide-y divide-[var(--sr-border)] border border-[var(--sr-border)] bg-[var(--sr-surface)] sm:hidden"
            aria-label="Verified record leaderboard list"
          >
            {filtered.map((entry) => {
              const submitter = submitterMap?.[entry.submitter_id];
              const mine = Boolean(profile && profile.id === entry.submitter_id);
              return (
                <li
                  key={entry.id}
                  className={`flex items-center gap-3 px-3 py-3 ${mine ? 'bg-[var(--sr-surface-2)]' : ''}`}
                >
                  <span
                    className={`sr-mono w-9 flex-shrink-0 text-xs font-semibold ${rankColor(entry.rank)}`}
                  >
                    {entry.rank <= 3 && (
                      <Medal aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                    )}
                    {rankText(entry.rank)}
                  </span>
                  <div className="min-w-0 flex-1">
                    {submitter ? (
                      <a
                        href={linkHref(`/profile/${submitter.username}`)}
                        className="inline-flex max-w-full items-center gap-2 font-semibold text-[var(--sr-link)] hover:underline"
                      >
                        <Avatar
                          name={submitter.username}
                          src={submitter.avatar_url}
                          className="h-6 w-6 text-[10px]"
                        />
                        <span className="truncate">{submitter.username}</span>
                        {mine && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sr-primary)]">
                            You
                          </span>
                        )}
                      </a>
                    ) : (
                      <span className="text-sm text-[var(--sr-text-muted)]">Unknown player</span>
                    )}
                    <p className="mt-0.5 truncate text-xs text-[var(--sr-text-muted)]">
                      {achievedDate(entry.verified_at ?? entry.created_at)} · {entry.platform}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="sr-mono whitespace-nowrap text-sm font-semibold text-[var(--sr-text)]">
                      {formatRecordValue(entry.value_numeric)}
                      {unit && <span className="ml-1 text-xs text-[var(--sr-text-muted)]">{unit}</span>}
                      {entry.rank === 1 && (
                        <span
                          className="ml-1 rounded-sm bg-[var(--sr-gold)]/15 px-1 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[var(--sr-gold)]"
                          title="World record"
                        >
                          WR
                        </span>
                      )}
                      <BadgeCheck
                        className="ml-1 inline h-3.5 w-3.5 text-[var(--sr-primary)]"
                        aria-label="Verified"
                      />
                    </span>
                    <a
                      href={entry.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
                      aria-label={`Watch ${submitter?.username ?? 'player'}'s proof video`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Full table on larger screens */}
          <div className="hidden overflow-x-auto rounded-sm border border-[var(--sr-border)] bg-[var(--sr-surface)] sm:block">
            <table className="w-full min-w-[600px] text-sm">
              <caption className="sr-only">
                Verified {competition.name} records sorted by value
              </caption>
              <thead>
                <tr className="border-b border-[var(--sr-border)] bg-[var(--sr-surface-2)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--sr-text-dim)]">
                  <th scope="col" className="w-16 py-2.5 pl-3 pr-2">Rank</th>
                  <th scope="col" className="px-2 py-2.5">Player</th>
                  <th scope="col" className="px-2 py-2.5">Record</th>
                  <th scope="col" className="hidden px-2 py-2.5 sm:table-cell">Unit</th>
                  <th scope="col" className="hidden px-2 py-2.5 md:table-cell">Achieved</th>
                  <th scope="col" className="w-12 px-2 py-2.5 text-right">Proof</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const submitter = submitterMap?.[entry.submitter_id];
                  const mine = Boolean(profile && profile.id === entry.submitter_id);
                  return (
                    <tr
                      key={entry.id}
                      className={`border-b border-[var(--sr-border)]/70 last:border-0 odd:bg-[var(--sr-bg-2)]/40 hover:bg-[var(--sr-surface-2)] ${mine ? 'bg-[var(--sr-surface)]/70' : ''} ${entry.rank === 1 ? 'border-l-2 border-l-[var(--sr-gold)]' : entry.rank === 2 ? 'border-l-2 border-l-[var(--sr-silver)]' : entry.rank === 3 ? 'border-l-2 border-l-[var(--sr-bronze)]' : ''}`}
                    >
                      <td className="py-3 pl-3 pr-2">
                        <span
                          className={`sr-mono inline-flex min-w-7 items-center gap-1 text-xs font-semibold ${rankColor(entry.rank)}`}
                        >
                          {entry.rank <= 3 && <Medal aria-hidden="true" className="h-3.5 w-3.5" />}
                          {rankText(entry.rank)}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        {submitter ? (
                          <a
                            href={linkHref(`/profile/${submitter.username}`)}
                            className="inline-flex items-center gap-2 font-semibold text-[var(--sr-link)] hover:underline"
                          >
                            <Avatar
                              name={submitter.username}
                              src={submitter.avatar_url}
                              className="h-7 w-7 text-[10px]"
                            />
                            {submitter.username}
                            {mine && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sr-primary)]">
                                You
                              </span>
                            )}
                          </a>
                        ) : (
                          <span className="text-[var(--sr-text-muted)]">Unknown player</span>
                        )}
                      </td>
                      <td className="sr-mono whitespace-nowrap px-2 py-3 font-semibold tabular-nums text-[var(--sr-text)]">
                        {formatRecordValue(entry.value_numeric)}
                        {entry.rank === 1 && (
                          <span
                            className="ml-1.5 rounded-sm bg-[var(--sr-gold)]/15 px-1 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-[var(--sr-gold)]"
                            title="World record"
                          >
                            WR
                          </span>
                        )}
                        <BadgeCheck
                          className="ml-1 inline h-3.5 w-3.5 text-[var(--sr-primary)]"
                          aria-label="Verified"
                        />
                      </td>
                      <td className="hidden px-2 py-3 text-[var(--sr-text-dim)] sm:table-cell">
                        {unit || '—'}
                      </td>
                      <td className="hidden px-2 py-3 text-xs text-[var(--sr-text-muted)] md:table-cell">
                        {achievedDate(entry.verified_at ?? entry.created_at)}
                      </td>
                      <td className="px-2 py-3 text-right">
                        <a
                          href={entry.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex p-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
                          aria-label={`Watch ${submitter?.username ?? 'player'}'s proof video`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {history.length > 0 && (
            <details className="mt-4 border border-[var(--sr-border)] bg-[var(--sr-surface)]">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[var(--sr-text)]">
                <History aria-hidden="true" className="h-4 w-4 text-[var(--sr-primary)]" />
                Record history
                <span className="sr-mono text-xs font-normal text-[var(--sr-text-muted)]">
                  {history.length} previous {history.length === 1 ? 'holder' : 'holders'}
                </span>
              </summary>
              <ol className="divide-y divide-[var(--sr-border)] border-t border-[var(--sr-border)]">
                {history.map((entry) => {
                  const submitter = submitterMap?.[entry.submitter_id];
                  return (
                    <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
                      <span className="sr-mono text-xs text-[var(--sr-text-muted)]">#{entry.rank}</span>
                      <span className="font-semibold text-[var(--sr-text)]">
                        {submitter?.username ?? 'Unknown player'}
                      </span>
                      <span className="sr-mono text-[var(--sr-text)]">
                        {formatRecordValue(entry.value_numeric)}
                        {unit && <span className="ml-1 text-xs text-[var(--sr-text-muted)]">{unit}</span>}
                      </span>
                      <span className="text-xs text-[var(--sr-text-muted)]">
                        {achievedDate(entry.verified_at ?? entry.created_at)}
                      </span>
                      {entry.beatenAt && (
                        <span className="text-xs text-[var(--sr-text-muted)]">
                          · beaten {timeAgo(entry.beatenAt)}
                        </span>
                      )}
                      <a
                        href={entry.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--sr-primary)] hover:underline"
                      >
                        Proof
                        <ExternalLink aria-hidden="true" className="h-3 w-3" />
                      </a>
                    </li>
                  );
                })}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}
