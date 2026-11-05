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
    <section className="sr-container py-10">
      <div className="sr-panel mx-auto max-w-3xl px-6 py-10 text-center">
        <p className="text-sm font-bold uppercase text-[var(--sr-link)]">Coming soon</p>
        <h1 className="mt-2 text-3xl font-extrabold text-[var(--sr-text)]">
          SplitRush opens November 7
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[var(--sr-text-dim)]">
          Leaderboards go live at 7:00 PM EST. Make an account now so your name is ready.
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
              className="rounded border border-[var(--sr-border)] bg-[var(--sr-bg-2)] px-3 py-4"
            >
              <p className="text-4xl font-bold tabular-nums text-[var(--sr-text)]">
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
