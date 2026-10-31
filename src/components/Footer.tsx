import { Logo } from '@/components/Logo';
import { linkHref } from '@/lib/router';

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--sr-border)] bg-[var(--sr-bg-2)]">
      <div className="sr-container flex flex-col items-start justify-between gap-4 py-5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
          <span className="hidden text-xs text-[var(--sr-text-muted)] sm:inline">Speedrun leaderboards</span>
        </div>
        <nav aria-label="Footer navigation" className="flex gap-5 text-xs text-[var(--sr-text-muted)]">
          <a href={linkHref('/')} className="hover:text-white">Home</a>
          <a href={linkHref('/games')} className="hover:text-white">Games</a>
          <a href={linkHref('/submit')} className="hover:text-white">Submit a run</a>
        </nav>
      </div>
    </footer>
  );
}
