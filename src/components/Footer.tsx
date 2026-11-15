import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/auth';
import { linkHref } from '@/lib/router';

export function Footer({ launchLocked = false }: { launchLocked?: boolean }) {
  const { profile } = useAuth();

  const internalLinks = [
    { label: 'Home', href: linkHref('/') },
    ...(!launchLocked
      ? [
          { label: 'Games', href: linkHref('/games') },
          ...(profile?.role === 'owner'
            ? [{ label: 'Daily Challenge', href: linkHref('/daily-challenge') }]
            : []),
          { label: 'Submit a run', href: linkHref('/submit') },
          { label: 'Request a game', href: linkHref('/request-game') },
        ]
      : []),
  ];

  return (
    <footer className="mt-auto border-t border-[var(--sr-border)] bg-[var(--sr-bg-2)]">
      <div className="sr-container grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
        {/* Brand */}
        <div className="min-w-0">
          <Logo size="sm" />
          <p className="mt-3 max-w-xs text-xs leading-5 text-[var(--sr-text-muted)]">
            Speedrun leaderboards with human-reviewed video proof. Every run is
            checked before it counts.
          </p>
        </div>

        {/* Site links */}
        <nav aria-label="Footer navigation">
          <p className="sr-stat-label">Leaderboards</p>
          <ul className="mt-3 space-y-2 text-sm">
            {internalLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="text-[var(--sr-text-dim)] transition-colors hover:text-[var(--sr-primary)]">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Community */}
        <nav aria-label="Community links">
          <p className="sr-stat-label">Community</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a href="https://discord.gg/JySJqfagAq" target="_blank" rel="noopener noreferrer" className="text-[var(--sr-text-dim)] transition-colors hover:text-[var(--sr-primary)]">
                Discord
              </a>
            </li>
            <li>
              <a href="https://www.youtube.com/@SplitRushOffical" target="_blank" rel="noopener noreferrer" className="text-[var(--sr-text-dim)] transition-colors hover:text-[var(--sr-primary)]">
                YouTube
              </a>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-[var(--sr-border)]">
        <div className="sr-container flex flex-col gap-1 py-4 text-xs text-[var(--sr-text-muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SplitRush</span>
          <span>Times are verified by owners before they hit the board.</span>
        </div>
      </div>
    </footer>
  );
}
