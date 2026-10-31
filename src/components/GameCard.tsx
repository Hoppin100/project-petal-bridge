import { Gamepad2, ArrowUpRight } from 'lucide-react';
import type { Game } from '@/lib/types';
import { linkHref } from '@/lib/router';

interface GameCardProps {
  game: Game;
  runCount?: number;
}

export function GameCard({ game, runCount }: GameCardProps) {
  return (
    <a href={linkHref(`/games/${game.slug}`)} className="group flex min-w-0 items-center gap-3 border border-[var(--sr-border)] bg-[var(--sr-surface)] p-2.5 transition-colors hover:border-[var(--sr-border-hover)] hover:bg-[var(--sr-surface-2)]">
      <span className="flex h-14 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[var(--sr-surface-2)] text-[var(--sr-text-muted)] sm:h-16 sm:w-24">
        {game.cover_url ? <img src={game.cover_url} alt={`${game.title} cover`} loading="lazy" className="h-full w-full object-cover" onError={(event) => event.currentTarget.remove()} /> : <Gamepad2 className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        {game.is_featured && <span className="mb-0.5 block text-[9px] font-bold uppercase tracking-[.14em] text-[var(--sr-primary)]">Featured</span>}
        <span className="block truncate text-sm font-semibold text-[var(--sr-text)] group-hover:text-white">{game.title}</span>
        <span className="mt-1 block truncate text-xs text-[var(--sr-text-muted)]">{game.source || game.blurb || (runCount !== undefined ? `${runCount} verified ${runCount === 1 ? 'run' : 'runs'}` : 'Leaderboard')}</span>
      </span>
      <span className="flex flex-shrink-0 items-center gap-1.5 text-xs text-[var(--sr-text-muted)]">
        {runCount !== undefined && <span className="hidden sm:inline">{runCount} runs</span>}
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}
