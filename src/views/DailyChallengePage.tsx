import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  ExternalLink,
  Gamepad2,
  RefreshCw,
  Trophy,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { countdownParts, fetchDailyChallenge, targetBeatingRule } from "@/lib/daily-challenge";
import type { DailyChallenge } from "@/lib/daily-challenge";
import { formatTime } from "@/lib/format";
import { linkHref } from "@/lib/router";

export function DailyChallengePage() {
  const { loading: authLoading, profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [challengeDate, setChallengeDate] = useState("");
  const [nextResetAt, setNextResetAt] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRequestedFor = useRef<string | null>(null);

  const loadChallenge = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDailyChallenge();
      if (result.error) {
        console.error("Could not load daily challenge", result.error);
        setError(result.error);
        setChallenge(null);
        setLoading(false);
        return;
      }

      setChallenge(result.challenge);
      setChallengeDate(result.challengeDate);
      setNextResetAt(result.nextResetAt);
    } catch (cause) {
      console.error("Could not load daily challenge", cause);
      setError("The daily challenge request failed.");
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isOwner) return;
    void loadChallenge();
  }, [authLoading, isOwner, loadChallenge]);

  useEffect(() => {
    const updateNow = () => setNow(Date.now());
    updateNow();
    const timer = window.setInterval(updateNow, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const resetTime = Date.parse(nextResetAt);
    if (
      now !== null &&
      Number.isFinite(resetTime) &&
      now >= resetTime &&
      refreshRequestedFor.current !== nextResetAt
    ) {
      refreshRequestedFor.current = nextResetAt;
      void loadChallenge();
    }
  }, [loadChallenge, nextResetAt, now]);

  const resetTime = Date.parse(nextResetAt);
  const [days, hours, minutes, seconds] = countdownParts(
    now !== null && Number.isFinite(resetTime) ? resetTime - now : 0,
  );
  const dateLabel = challengeDate
    ? new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${challengeDate}T00:00:00Z`))
    : null;

  if (authLoading) {
    return (
      <div className="sr-container flex min-h-64 items-center justify-center py-8" role="status">
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--sr-primary)] border-t-transparent" />
        <span className="sr-only">Checking access</span>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="sr-container py-20 text-center">
        <h1 className="text-2xl font-bold text-[var(--sr-text)]">Page not found</h1>
        <Link to="/" className="sr-btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" />
          Home
        </Link>
      </div>
    );
  }

  return (
    <div className="sr-container max-w-4xl py-8">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-1 text-sm text-[var(--sr-text-muted)] transition-colors hover:text-[var(--sr-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      <header className="mb-6">
        <p className="sr-eyebrow flex items-center gap-2">
          <Trophy aria-hidden="true" className="h-4 w-4" />
          Same challenge for everyone
        </p>
        <h1 className="text-3xl font-bold text-[var(--sr-text)] sm:text-4xl">Daily Challenge</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--sr-text-muted)]">
          Take on one verified record selected for the whole community. A new challenge begins every
          day at <strong className="text-[var(--sr-text)]">00:00 UTC</strong>.
        </p>
      </header>

      {loading ? (
        <div className="sr-panel flex min-h-64 items-center justify-center" role="status">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--sr-primary)] border-t-transparent" />
          <span className="sr-only">Loading daily challenge</span>
        </div>
      ) : error ? (
        <div className="sr-panel p-6 text-center">
          <p role="alert" className="text-sm text-red-300">
            The daily challenge could not be loaded. Please try again.
          </p>
          <button type="button" onClick={() => void loadChallenge()} className="sr-btn-ghost mt-4">
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : challenge ? (
        <article className="sr-panel overflow-hidden">
          <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="min-w-0">
              <p className="sr-eyebrow">
                {dateLabel ? `Challenge for ${dateLabel} (UTC)` : "Today’s challenge"}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[var(--sr-text)]">
                {challenge.game_title}
              </h2>
              <p className="mt-1 text-[var(--sr-text-dim)]">
                {challenge.category_name}
                {challenge.subcategory_name ? ` · ${challenge.subcategory_name}` : ""}
              </p>

              <div className="mt-6 rounded-sm border border-[var(--sr-border)] bg-[var(--sr-surface-2)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
                  Target record · completion time
                </p>
                <p className="sr-mono mt-2 text-3xl font-bold tabular-nums text-[var(--sr-text)]">
                  {formatTime(challenge.record_time_ms)}
                </p>
                <p className="mt-2 text-sm text-[var(--sr-text-dim)]">
                  Held by{" "}
                  <a
                    href={linkHref(
                      `/profile/${encodeURIComponent(challenge.record_holder_username)}`,
                    )}
                    className="sr-link font-semibold"
                  >
                    {challenge.record_holder_username}
                  </a>
                </p>
              </div>

              <p className="mt-4 border-l-2 border-[var(--sr-primary)] pl-3 text-sm text-[var(--sr-text)]">
                {targetBeatingRule(challenge.higher_is_better)} An equal time does not beat the
                record.
              </p>

              {challenge.rules && (
                <section className="mt-5" aria-labelledby="daily-challenge-rules">
                  <h3
                    id="daily-challenge-rules"
                    className="text-sm font-bold text-[var(--sr-text)]"
                  >
                    Rules
                  </h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--sr-text-dim)]">
                    {challenge.rules}
                  </p>
                </section>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  href={challenge.record_video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="sr-btn-primary"
                >
                  <ExternalLink className="h-4 w-4" />
                  Watch target record
                </a>
                {challenge.game_page_url && (
                  <a
                    href={challenge.game_page_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sr-btn-ghost"
                  >
                    <Gamepad2 className="h-4 w-4" />
                    Game page
                  </a>
                )}
                <a href={linkHref(`/games/${challenge.game_slug}`)} className="sr-btn-ghost">
                  Leaderboard
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-sm border border-[var(--sr-border)] bg-[var(--sr-surface-2)] text-[var(--sr-text-muted)]">
                {challenge.game_cover_url ? (
                  <img
                    src={challenge.game_cover_url}
                    alt={`${challenge.game_title} cover`}
                    className="h-full w-full object-cover"
                    onError={(event) => event.currentTarget.remove()}
                  />
                ) : (
                  <Gamepad2 aria-hidden="true" className="h-10 w-10" />
                )}
              </div>

              <div className="rounded-sm border border-[var(--sr-border)] bg-[var(--sr-surface-2)] p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
                  <Clock3 aria-hidden="true" className="h-4 w-4" />
                  Next challenge in
                </p>
                <p className="sr-mono mt-2 text-xl font-bold tabular-nums text-[var(--sr-text)]">
                  {days > 0 ? `${days}d ` : ""}
                  {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
                  {String(seconds).padStart(2, "0")}
                </p>
                <p className="mt-1 text-xs text-[var(--sr-text-muted)]">Resets at 00:00 UTC</p>
              </div>
            </div>
          </div>
        </article>
      ) : (
        <div className="sr-panel p-6 text-center sm:p-10">
          <Trophy className="mx-auto h-10 w-10 text-[var(--sr-primary)]" />
          <h2 className="mt-4 text-xl font-bold text-[var(--sr-text)]">
            No challenge available yet
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--sr-text-muted)]">
            There are no verified records in an eligible game category yet. A challenge will appear
            when a valid record is available.
          </p>
          <div className="mt-5 flex flex-col items-center gap-2">
            <p className="text-sm text-[var(--sr-text-muted)]">
              {days > 0 ? `${days}d ` : ""}
              {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
              {String(seconds).padStart(2, "0")} until the next selection at 00:00 UTC.
            </p>
            <button type="button" onClick={() => void loadChallenge()} className="sr-btn-ghost">
              <RefreshCw className="h-4 w-4" />
              Check again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
