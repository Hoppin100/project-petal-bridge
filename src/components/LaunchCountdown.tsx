import { Clock3 } from 'lucide-react';

export const LAUNCH_AT = Date.UTC(2026, 10, 8, 0, 0, 0);

interface LaunchCountdownProps {
  now: number;
  username?: string | undefined;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

export function LaunchCountdown({
  now,
  username,
  onOpenAuth,
}: LaunchCountdownProps) {
  const remaining = Math.max(0, LAUNCH_AT - now);
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);

  return (
    <section className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-16">
      <div className="w-full max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border border-[var(--sr-primary)]/40 bg-[var(--sr-primary)]/10 text-[var(--sr-primary)]">
          <Clock3 className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="sr-mono text-xs font-semibold uppercase tracking-[0.25em] text-[var(--sr-primary)]">
          The starting line is almost here
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--sr-text)] sm:text-6xl">
          SplitRush is launching soon
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--sr-text-dim)]">
          We go live November 7, 2026 at 7:00 PM EST. Get ready to race up the
          leaderboards.
        </p>

        <div
          aria-label="Time until SplitRush launches"
          className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            ['Days', days],
            ['Hours', hours],
            ['Minutes', minutes],
            ['Seconds', seconds],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border border-[var(--sr-border)] bg-[var(--sr-surface)] px-3 py-5"
            >
              <p className="sr-mono text-4xl font-semibold tabular-nums text-[var(--sr-text)] sm:text-5xl">
                {String(value).padStart(2, '0')}
              </p>
              <p className="mt-2 text-xs font-medium uppercase tracking-widest text-[var(--sr-text-muted)]">
                {label}
              </p>
            </div>
          ))}
        </div>

        {username ? (
          <p className="mt-8 text-sm text-[var(--sr-text-dim)]">
            Signed in as <span className="font-semibold text-[var(--sr-text)]">{username}</span>.
            Your account will be ready when we launch.
          </p>
        ) : (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              className="sr-btn-primary"
              onClick={() => onOpenAuth('signup')}
            >
              Create an account
            </button>
            <button
              className="sr-btn-ghost"
              onClick={() => onOpenAuth('signin')}
            >
              Sign in
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
