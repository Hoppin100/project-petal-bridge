import { useState, useEffect, useRef } from 'react';
import { Search, X, Gamepad2 } from 'lucide-react';
import type { Game } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { linkHref, goTo } from '@/lib/router';


interface SearchBarProps {
  onNavigate?: () => void;
  variant?: 'full' | 'compact';
}

export function SearchBar({ onNavigate, variant = 'full' }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Game[]>([]);
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against an older, slower search response overwriting a newer one.
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      const { data } = await supabase
        .from('games')
        .select('id, slug, title, cover_url, blurb, is_featured, created_at')
        .ilike('title', `%${query.trim()}%`)
        .limit(8);
      if (requestId !== requestIdRef.current) return;
      setResults((data as Game[]) ?? []);
      setOpen(true);
      setFocusedIndex(-1);
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const game = results[focusedIndex];
      if (game) go(game.slug);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  function go(slug: string) {
    goTo(`/games/${slug}`);
    setQuery('');
    setOpen(false);
    onNavigate?.();
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search games..."
          className={`sr-input pl-9 ${query ? 'pr-9' : ''} ${variant === 'compact' ? 'py-1.5' : ''}`}
          aria-label="Search games"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="game-search-results"
          aria-activedescendant={focusedIndex >= 0 ? `game-search-option-${focusedIndex}` : undefined}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--sr-text-muted)] hover:bg-[var(--sr-surface-2)] hover:text-[var(--sr-text)]"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div id="game-search-results" role="listbox" className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-[var(--sr-border)] bg-[var(--sr-surface)] shadow-2xl">
          {results.map((game, i) => (
            <a
              key={game.id}
              id={`game-search-option-${i}`}
              role="option"
              aria-selected={i === focusedIndex}
              href={linkHref(`/games/${game.slug}`)}
              onClick={() => {
                setQuery('');
                setOpen(false);
                onNavigate?.();
              }}
              className={`flex items-center gap-3 px-3 py-2 transition-colors ${
                i === focusedIndex
                  ? 'bg-[var(--sr-surface-2)]'
                  : 'hover:bg-[var(--sr-surface-2)]'
              }`}
            >
              {game.cover_url ? (
                <img
                  src={game.cover_url}
                  alt=""
                  className="h-10 w-10 rounded-sm object-cover"
                  onError={(event) => event.currentTarget.remove()}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--sr-surface-2)] text-[var(--sr-text-muted)]"><Gamepad2 className="h-4 w-4" /></div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-emerald-50">
                  {game.title}
                </p>
                {game.blurb && (
                  <p className="truncate text-xs text-emerald-700">
                    {game.blurb.slice(0, 60)}
                  </p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {open && query.trim().length >= 2 && results.length === 0 && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-[var(--sr-border)] bg-[var(--sr-surface)] px-3 py-3 text-sm text-emerald-700">
          No games found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
