import { Logo } from '@/components/Logo';
import { linkHref } from '@/lib/router';

export function Footer({ launchLocked = false }: { launchLocked?: boolean }) {
  return (
    <footer className="mt-auto border-t border-[var(--sr-border)] bg-[var(--sr-bg-2)]">
      <div className="sr-container flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <span className="hidden text-xs text-[var(--sr-text-muted)] sm:inline">Speedrun leaderboards</span>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--sr-text-muted)]">
          <a href={linkHref('/')} className="transition-colors hover:text-[var(--sr-primary)]">Home</a>
          <a href="https://discord.gg/JySJqfagAq" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--sr-primary)]">Join our Discord</a>
          <a href="https://www.youtube.com/@SplitRushOffical" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-[var(--sr-primary)]">YouTube</a>
          {!launchLocked && <>
            <a href={linkHref('/games')} className="transition-colors hover:text-[var(--sr-primary)]">Games</a>
            <a href={linkHref('/submit')} className="transition-colors hover:text-[var(--sr-primary)]">Submit a run</a>
          </>}
        </nav>
      </div>
    </footer>
  );
}
