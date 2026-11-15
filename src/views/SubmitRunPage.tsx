import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Send, Youtube, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Game, Category } from '@/lib/types';
import { isComingSoonGame } from '@/lib/games';
import { isValidYouTubeUrl, parseYouTubeId, formatTime } from '@/lib/format';
import { linkHref } from '@/lib/router';

interface SubmitRunPageProps {
  onRequireAuth: () => void;
}

export function SubmitRunPage({ onRequireAuth }: SubmitRunPageProps) {
  const { session, profile, loading } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [gameId, setGameId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [millis, setMillis] = useState('');
  const [platform, setPlatform] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoStart, setVideoStart] = useState('');
  const [videoEnd, setVideoEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [validationField, setValidationField] = useState<'game' | 'category' | 'time' | 'video' | 'markers' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Only ask people to sign in once the stored session has actually been
  // read: on a hard page load the session is still null for a moment, and
  // opening the dialog then would block someone who is already signed in.
  useEffect(() => {
    if (!loading && !session) onRequireAuth();
  }, [loading, session, onRequireAuth]);

  useEffect(() => {
    (async () => {
      const { data: g, error: gameError } = await supabase
        .from('games')
        .select('id, slug, title, cover_url, blurb, is_featured, created_at')
        .order('title');
      if (gameError) setLoadError('Games could not be loaded. Refresh and try again.');
      setGames((g as Game[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!gameId) return;
    let current = true;
    setCategories([]);
    setCategoryId('');
    setExpandedCategoryId(null);
    (async () => {
      const { data: c, error: categoryError } = await supabase
        .from('categories')
        .select('id, game_id, parent_category_id, name, timing_rules, sort_order, created_at')
        .eq('game_id', gameId)
        .order('sort_order')
        .order('name');
      if (!current) return;
      if (categoryError) {
        setLoadError('Categories could not be loaded. Choose the game again.');
        return;
      }
      const catList = (c as Category[]) ?? [];
      const firstMainCategory = catList.find((category) => !category.parent_category_id);
      setCategories(catList);
      const firstMainHasSubcategories = firstMainCategory
        ? catList.some((category) => category.parent_category_id === firstMainCategory.id)
        : false;
      setCategoryId(firstMainCategory && !firstMainHasSubcategories ? firstMainCategory.id : '');
      if (firstMainCategory && firstMainHasSubcategories) {
        setExpandedCategoryId(firstMainCategory.id);
      }
    })();
    return () => { current = false; };
  }, [gameId]);

  const videoValid = isValidYouTubeUrl(videoUrl);
  const videoId = parseYouTubeId(videoUrl);
  const startSeconds = parseVideoTimestamp(videoStart);
  const endSeconds = parseVideoTimestamp(videoEnd);
  const mainCategories = categories.filter((category) => !category.parent_category_id);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const selectedGame = games.find((game) => game.id === gameId);
  const selectedGameComingSoon = selectedGame ? isComingSoonGame(selectedGame) : false;

  const timeMs = (() => {
    const h = parseInt(hours || '0', 10) || 0;
    const m = parseInt(minutes || '0', 10) || 0;
    const s = parseInt(seconds || '0', 10) || 0;
    const ms = parseInt(millis || '0', 10) || 0;
    return h * 3_600_000 + m * 60_000 + s * 1000 + ms;
  })();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setValidationField(null);
    setSuccess(null);

    if (!session || !profile) {
      onRequireAuth();
      return;
    }
    if (!gameId) {
      setValidationField('game');
      setError('Please select a game.');
      return;
    }
    if (selectedGame && isComingSoonGame(selectedGame)) {
      setError(`Cannot submit a run yet — ${selectedGame.title} hasn’t been released.`);
      return;
    }
    if (
      !categoryId ||
      (!selectedCategory?.parent_category_id &&
        categories.some((category) => category.parent_category_id === selectedCategory?.id))
    ) {
      setValidationField('category');
      setError('Please select a subcategory for the chosen main category.');
      return;
    }
    if (timeMs <= 0) {
      setValidationField('time');
      setError('Please enter a valid completion time.');
      return;
    }
    if (timeMs > 100 * 3_600_000) {
      setValidationField('time');
      setError('Completion times must be under 100 hours.');
      return;
    }
    if (!isValidYouTubeUrl(videoUrl)) {
      setValidationField('video');
      setError('Please provide a valid YouTube URL as video proof.');
      return;
    }
    if (!videoStart.trim() || !videoEnd.trim()) {
      setValidationField('markers');
      setError('Enter both the run start and run end video markers.');
      return;
    }
    if (startSeconds === null || endSeconds === null) {
      setValidationField('markers');
      setError('Enter video markers as mm:ss or hh:mm:ss.');
      return;
    }
    if (startSeconds !== null && endSeconds !== null && endSeconds <= startSeconds) {
      setValidationField('markers');
      setError('The video end marker must be after the start marker.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase
        .from('runs')
        .insert({
          game_id: gameId,
          category_id: categoryId,
          time_ms: timeMs,
          platform: platform.trim() || 'Unknown',
          video_url: videoUrl.trim(),
          video_id: videoId,
          video_start_seconds: startSeconds,
          video_end_seconds: endSeconds,
          notes: notes.trim() || null,
        });

      if (insertError) throw insertError;
      setSuccess(
        'Run submitted! It is pending owner review. An owner can request a video assessment from the dashboard.'
      );
      setHours('');
      setMinutes('');
      setSeconds('');
      setMillis('');
      setVideoUrl('');
      setVideoStart('');
      setVideoEnd('');
      setNotes('');
    } catch (cause) {
      console.error('submit failed', cause);
      setError('Could not submit your run. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // While the stored session is still being read, show neither the form nor
  // the "sign in" message — a signed-in person reloading this page would
  // otherwise see the sign-in prompt flash first.
  if (loading) {
    return (
      <div className="sr-container py-20 text-center">
        <p className="text-[var(--sr-text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="sr-container py-20 text-center">
        <p className="text-[var(--sr-text)]">Sign in to submit a run.</p>
        <button onClick={onRequireAuth} className="sr-btn-primary mt-4">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="sr-container max-w-3xl py-8">
      <a
        href={linkHref('/games')}
        className="mb-5 inline-flex items-center gap-1 text-sm text-[var(--sr-text-muted)] transition-colors hover:text-[var(--sr-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to games
      </a>

      <header className="mb-6">
        <p className="sr-eyebrow">Run submission</p>
        <h1 className="text-3xl font-bold">Submit a run</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--sr-text-muted)]">
          Provide your completion time and a YouTube link as proof. Owners will
          review your submission before it appears on the leaderboard.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="sr-panel flex flex-col gap-5 p-4 sm:p-6">
        {loadError && <p role="alert" className="border-l-2 border-[var(--sr-danger)] bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">{loadError}</p>}
        <p className="sr-rule-title">Run</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="run-game" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
              Game
            </label>
            <select
              id="run-game"
              value={gameId}
              onChange={(e) => setGameId(e.target.value)}
              className="sr-input"
              required
            >
              <option value="">Select a game...</option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
            {validationField === 'game' && error && <p role="alert" className="mt-1 text-xs text-[var(--sr-danger)]">{error}</p>}
            {selectedGameComingSoon && (
              <p role="status" className="mt-2 text-sm text-[var(--sr-warn)]">
                Cannot submit a run yet — {selectedGame?.title} hasn’t been released.
              </p>
            )}
          </div>
          <fieldset aria-required="true">
            <legend className="mb-1 block text-sm font-medium text-[var(--sr-text)]">Category</legend>
            {!gameId ? (
              <p className="text-sm text-[var(--sr-text-muted)]">Choose a game to see its categories.</p>
            ) : mainCategories.length === 0 ? (
              <p className="text-sm text-[var(--sr-text-muted)]">This game has no categories available.</p>
            ) : (
              <div className="flex flex-col gap-2" role="group" aria-label="Main categories">
                {mainCategories.map((mainCategory) => {
                  const subcategories = categories.filter(
                    (category) => category.parent_category_id === mainCategory.id
                  );
                  const isSelected =
                    selectedCategory?.id === mainCategory.id ||
                    selectedCategory?.parent_category_id === mainCategory.id;
                  const isExpanded = expandedCategoryId === mainCategory.id;
                  return (
                    <div key={mainCategory.id} className="border border-[var(--sr-border)] bg-[var(--sr-surface)]">
                      <button
                        type="button"
                        aria-expanded={subcategories.length > 0 ? isExpanded : undefined}
                        onClick={() => {
                            if (subcategories.length > 0) {
                              if (
                                expandedCategoryId !== mainCategory.id ||
                                selectedCategory?.parent_category_id !== mainCategory.id
                              ) {
                                setCategoryId('');
                              }
                              setExpandedCategoryId((current) =>
                                current === mainCategory.id ? null : mainCategory.id
                              );
                            } else {
                              setCategoryId(mainCategory.id);
                              setExpandedCategoryId(null);
                            }
                        }}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                          isSelected
                            ? 'bg-[var(--sr-primary)]/10 text-[var(--sr-text)]'
                            : 'text-[var(--sr-text-dim)] hover:bg-[var(--sr-surface-2)] hover:text-[var(--sr-text)]'
                        }`}
                      >
                        <span>{mainCategory.name}</span>
                        {subcategories.length > 0 &&
                          (isExpanded ? (
                            <ChevronDown aria-hidden="true" className="h-4 w-4 text-[var(--sr-primary)]" />
                          ) : (
                            <ChevronRight aria-hidden="true" className="h-4 w-4 text-[var(--sr-text-muted)]" />
                          ))}
                      </button>
                      {isExpanded && subcategories.length > 0 && (
                        <div className="border-t border-[var(--sr-border)] p-3">
                          <label
                            htmlFor={`run-subcategory-${mainCategory.id}`}
                            className="mb-1 block text-xs font-medium text-[var(--sr-text-muted)]"
                          >
                            Subcategory
                          </label>
                          <select
                            id={`run-subcategory-${mainCategory.id}`}
                            value={
                              selectedCategory?.parent_category_id === mainCategory.id
                                ? selectedCategory.id
                                : ''
                            }
                            onChange={(event) => setCategoryId(event.target.value)}
                            className="sr-input"
                            required
                          >
                            <option value="">Select a subcategory...</option>
                            {subcategories.map((subcategory) => (
                              <option key={subcategory.id} value={subcategory.id}>
                                {subcategory.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {validationField === 'category' && error && (
              <p role="alert" className="mt-1 text-xs text-[var(--sr-danger)]">{error}</p>
            )}
          </fieldset>
        </div>

        {selectedCategory?.timing_rules && (
          <div className="flex items-start gap-2 border-l-2 border-[var(--sr-border-hover)] bg-[var(--sr-surface-2)] px-3 py-2.5 text-sm text-[var(--sr-text-dim)]">
            <span className="font-semibold text-[var(--sr-text)]">Timing rules: </span>
            {selectedCategory.timing_rules}
          </div>
        )}

        {/* Time input */}
        <p className="sr-rule-title">Time</p>
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-[var(--sr-text)]" htmlFor="run-hours">
            <Clock className="h-4 w-4 text-[var(--sr-primary)]" />
            Completion time
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <TimeField id="run-hours" label="h" value={hours} onChange={setHours} max={99} />
            <span className="text-[var(--sr-text-muted)]">:</span>
            <TimeField id="run-minutes" label="m" value={minutes} onChange={setMinutes} max={59} />
            <span className="text-[var(--sr-text-muted)]">:</span>
            <TimeField id="run-seconds" label={"s"} value={seconds} onChange={setSeconds} max={59} />
            <span className="text-[var(--sr-text-muted)]">.</span>
            <TimeField
              label="ms"
              id="run-millis"
              value={millis}
              onChange={setMillis}
              max={999}
              width="w-20"
            />
            {timeMs > 0 && (
              <span className="ml-2 sr-mono text-sm text-[var(--sr-primary)]">
                = {formatTime(timeMs)}
              </span>
            )}
          </div>
          {validationField === 'time' && error && <p role="alert" className="mt-1 text-xs text-[var(--sr-danger)]">{error}</p>}
        </div>

        <div>
          <label htmlFor="run-platform" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
            Platform
          </label>
          <input
            id="run-platform"
            type="text"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="e.g. PC, Nintendo 64, Switch"
            className="sr-input"
          />
        </div>

        <div>
          <p className="sr-rule-title">Video proof</p>
          <div className="mt-3 space-y-4">
          <label htmlFor="run-video" className="mb-1 flex items-center gap-1.5 text-sm font-medium text-[var(--sr-text)]">
            <Youtube className="h-4 w-4 text-red-500" />
            YouTube proof URL
          </label>
          <input
            id="run-video"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="sr-input"
            required
          />
          {videoUrl && !videoValid && (
            <p className="mt-1 text-xs text-[var(--sr-danger)]">
              Enter a valid YouTube link (watch, youtu.be, embed, or shorts).
            </p>
          )}
          {validationField === 'video' && error && <p role="alert" className="mt-1 text-xs text-[var(--sr-danger)]">{error}</p>}
          {videoValid && videoId && (
            <p className="mt-1 text-xs text-[var(--sr-primary)]">
              Valid YouTube link detected.
            </p>
          )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[var(--sr-text)]">
            Run starts in video <span className="text-[var(--sr-primary)]">Required</span>
            <input type="text" inputMode="numeric" value={videoStart} onChange={(e) => setVideoStart(e.target.value)} placeholder="e.g. 1:24 or 00:01:24" className="sr-input mt-1" required />
          </label>
          <label className="block text-sm font-medium text-[var(--sr-text)]">
            Run ends in video <span className="text-[var(--sr-primary)]">Required</span>
            <input type="text" inputMode="numeric" value={videoEnd} onChange={(e) => setVideoEnd(e.target.value)} placeholder="e.g. 3:52 or 00:03:52" className="sr-input mt-1" required />
          </label>
          <p className="text-xs leading-5 text-[var(--sr-text-muted)] sm:col-span-2">Both markers are required. Enter them as mm:ss or hh:mm:ss to help reviewers jump to the start and finish.</p>
          {validationField === 'markers' && error && <p role="alert" className="text-xs text-[var(--sr-danger)] sm:col-span-2">{error}</p>}
        </div>
          </div>
        </div>

        <div>
          <label htmlFor="run-notes" className="mb-1 block text-sm font-medium text-[var(--sr-text)]">
            Notes (optional)
          </label>
          <textarea
            id="run-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any details about your run..."
            rows={3}
            className="sr-input resize-none"
          />
        </div>

        {error && !validationField && (
          <div className="border-l-2 border-[var(--sr-danger)] bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
            {error}
          </div>
        )}
        {success && (
          <div className="border-l-2 border-[var(--sr-primary)] bg-[var(--sr-ok-bg)] px-3 py-3 text-sm text-[var(--sr-text)]">
            {success}
          </div>
        )}

        <button type="submit" disabled={submitting || selectedGameComingSoon} className="sr-btn-primary">
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Submit run
        </button>
      </form>
    </div>
  );
}

function parseVideoTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) return null;
  const nums = parts.map(Number);
  if (nums.slice(1).some((part) => part > 59)) return null;
  return nums.length === 2 ? nums[0]! * 60 + nums[1]! : nums[0]! * 3600 + nums[1]! * 60 + nums[2]!;
}

function TimeField({
  id,
  label,
  value,
  onChange,
  max,
  width = 'w-16',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  width?: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <input
        id={id}
        type="number"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '' || (/^\d+$/.test(v) && parseInt(v, 10) <= max)) {
            onChange(v);
          }
        }}
        placeholder="0"
        className={`sr-input text-center ${width}`}
      />
      <span className="mt-0.5 text-[10px] uppercase text-[var(--sr-text-muted)]">
        {label}
      </span>
    </div>
  );
}
