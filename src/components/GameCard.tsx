import { Gamepad2 } from 'lucide-react';
import type { Game } from '@/lib/types';
import { linkHref } from '@/lib/router';
import { isComingSoonGame } from '@/lib/games';

interface GameCardProps {
  game: Game;
  runCount?: number;
}

export function GameCard({ game, runCount }: GameCardProps) {
  const comingSoon = isComingSoonGame(game);
  return (
    <a href={linkHref(`/games/${game.slug}`)} className="group block min-w-0 rounded-sm focus-visible:outline-offset-4">
      <span className="relative block aspect-[3/4] overflow-hidden rounded-sm border border-[var(--sr-border)] bg-[var(--sr-surface-2)] transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[var(--sr-primary)] group-focus-visible:border-[var(--sr-primary)]">
        {game.cover_url ? <img src={game.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" onError={(event) => event.currentTarget.remove()} /> : <span className="flex h-full items-center justify-center text-[var(--sr-text-muted)]"><Gamepad2 className="h-8 w-8" /></span>}
        {game.is_featured && <span className="absolute left-1.5 top-1.5 rounded-sm bg-[var(--sr-primary)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--primary-foreground)]">Featured</span>}
        {comingSoon && <span className="absolute right-1.5 top-1.5 rounded-sm bg-[var(--sr-warn)] px-1.5 py-0.5 text-[10px] font-bold text-black">Coming soon</span>}
      </span>
      <span className="mt-2 block truncate text-sm font-semibold text-[var(--sr-text)] transition-colors group-hover:text-[var(--sr-primary)]">{game.title}</span>
      {runCount !== undefined && <span className="mt-1 inline-flex text-xs text-[var(--sr-text-muted)]">{runCount} {runCount === 1 ? 'run' : 'runs'}</span>}
    </a>
  );
}
