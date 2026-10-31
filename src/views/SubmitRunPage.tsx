import { runVerification } from '@/lib/verify-run.functions';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Send, Youtube, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Game, Category } from '@/lib/types';
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
  const [validationField, setValidationField] = useState<'game' | 'time' | 'video' | 'markers' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only ask people to sign in once the stored session has actually been
  // read: on a hard page load the session is still null for a moment, and
  // opening the dialog then would block someone who is already signed in.
  useEffect(() => {
    if (!loading && !session) onRequireAuth();
  }, [loading, session, onRequireAuth]);

  useEffect(() => {
    (async () => {
      const { data: g } = await supabase
        .from('games')
        .select('id, slug, title, cover_url, blurb, is_featured, created_at')
        .order('title');
      setGames((g as Game[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!gameId) return;
    (async () => {
      const { data: c } = await supabase
        .from('categories')
        .select('id, game_id, name, timing_rules, sort_order, created_at')
        .eq('game_id', gameId)
        .order('sort_order')
        .order('name');
      const catList = (c as Category[]) ?? [];
      setCategories(catList);
      setCategoryId(catList[0]?.id ?? '');
    })();
  }, [gameId]);

  const videoValid = isValidYouTubeUrl(videoUrl);
  const videoId = parseYouTubeId(videoUrl);
  const startSeconds = parseVideoTimestamp(videoStart);
  const endSeconds = parseVideoTimestamp(videoEnd);

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
    if (!gameId || !categoryId) {
      setValidationField('game');
      setError('Please select a game and category.');
      return;
    }
    if (timeMs <= 0) {
      setValidationField('time');
      setError('Please enter a valid completion time.');
      return;
    }
    if (!isValidYouTubeUrl(videoUrl)) {
      setValidationField('video');
      setError('Please provide a valid YouTube URL as video proof.');
      return;
    }
    if ((videoStart.trim() && startSeconds === null) || (videoEnd.trim() && endSeconds === null)) {
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
      const { data, error: insertError } = await supabase
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
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      const runId = data.id;

      // Trigger AI assessment via edge function (best-effort, non-blocking).
      // The function may fail or be unavailable; the run stays pending for
      // manual review either way.
      try {
        await runVerification({ data: { runId } });
      } catch (aiErr) {
        console.warn('AI assessment unavailable, run remains pending', aiErr);
      }

      setSuccess(
        'Run submitted! It is now pending owner review. The SplitRush Verification Assistant will prepare an assessment for the owners.'
      );
      setHours('');
      setMinutes('');
      setSeconds('');
      setMillis('');
      setVideoUrl('');
      setVideoStart('');
      setVideoEnd('');
      setNotes('');
      void runId;
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
        <p className="text-emerald-700">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="sr-container py-20 text-center">
        <p className="text-emerald-100">Sign in to submit a run.</p>
        <button onClick={onRequireAuth} className="sr-btn-primary mt-4">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="sr-container max-w-3xl py-8">
      <a
        href={linkHref('/')}
        className="mb-6 inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </a>

      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-[var(--sr-primary)]">Run submission</p>
      <h1 className="text-3xl font-bold">Submit a run</h1>
      <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--sr-text-muted)]">
        Provide your completion time and a YouTube link as proof. Owners will
        review your submission before it appears on the leaderboard.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 border-y border-[var(--sr-border)] py-5 sm:grid-cols-2">
          <div>
            <label htmlFor="run-game" className="mb-1 block text-sm font-medium text-emerald-100">
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
            {validationField === 'game' && error && <p role="alert" className="mt-1 text-xs text-red-400">{error}</p>}
          </div>
          <div>
            <label htmlFor="run-category" className="mb-1 block text-sm font-medium text-emerald-100">
              Category
            </label>
            <select
              id="run-category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="sr-input"
              required
              disabled={!gameId}
            >
              <option value="">Select a category...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {categories.find((c) => c.id === categoryId)?.timing_rules && (
          <div className="rounded-lg border border-[var(--sr-border)] bg-[var(--sr-surface)] p-3 text-sm text-emerald-100/80">
            <span className="font-semibold text-emerald-50">Timing rules: </span>
            {categories.find((c) => c.id === categoryId)?.timing_rules}
          </div>
        )}

        {/* Time input */}
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-emerald-100" htmlFor="run-hours">
            <Clock className="h-4 w-4 text-[var(--sr-primary)]" />
            Completion time
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <TimeField id="run-hours" label="h" value={hours} onChange={setHours} max={99} />
            <span className="text-emerald-700">:</span>
            <TimeField id="run-minutes" label="m" value={minutes} onChange={setMinutes} max={59} />
            <span className="text-emerald-700">:</span>
            <TimeField id="run-seconds" label={"s"} value={seconds} onChange={setSeconds} max={59} />
            <span className="text-emerald-700">.</span>
            <TimeField
              label="ms"
              id="run-millis"
              value={millis}
              onChange={setMillis}
              max={999}
              width="w-20"
            />
            {timeMs > 0 && (
              <span className="ml-2 font-mono text-sm text-[var(--sr-primary)]">
                = {formatTime(timeMs)}
              </span>
            )}
          </div>
          {validationField === 'time' && error && <p role="alert" className="mt-1 text-xs text-red-400">{error}</p>}
        </div>

        <div>
          <label htmlFor="run-platform" className="mb-1 block text-sm font-medium text-emerald-100">
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
          <label htmlFor="run-video" className="mb-1 flex items-center gap-1.5 text-sm font-medium text-emerald-100">
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
            <p className="mt-1 text-xs text-red-400">
              Enter a valid YouTube link (watch, youtu.be, embed, or shorts).
            </p>
          )}
          {validationField === 'video' && error && <p role="alert" className="mt-1 text-xs text-red-400">{error}</p>}
          {videoValid && videoId && (
            <p className="mt-1 text-xs text-emerald-400">
              Valid YouTube link detected.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-emerald-100">
            Run starts in video <span className="text-emerald-700">(optional)</span>
            <input type="text" inputMode="numeric" value={videoStart} onChange={(e) => setVideoStart(e.target.value)} placeholder="e.g. 1:24 or 00:01:24" className="sr-input mt-1" />
          </label>
          <label className="block text-sm font-medium text-emerald-100">
            Run ends in video <span className="text-emerald-700">(optional)</span>
            <input type="text" inputMode="numeric" value={videoEnd} onChange={(e) => setVideoEnd(e.target.value)} placeholder="e.g. 3:52 or 00:03:52" className="sr-input mt-1" />
          </label>
          <p className="text-xs leading-5 text-emerald-700 sm:col-span-2">These markers help reviewers jump to the start and finish during manual review.</p>
          {validationField === 'markers' && error && <p role="alert" className="text-xs text-red-400 sm:col-span-2">{error}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-emerald-100">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any details about your run..."
            rows={3}
            className="sr-input resize-none"
          />
        </div>

        {error && !validationField && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}

        <button type="submit" disabled={submitting} className="sr-btn-primary">
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
      <span className="mt-0.5 text-[10px] uppercase text-emerald-700">
        {label}
      </span>
    </div>
  );
}
