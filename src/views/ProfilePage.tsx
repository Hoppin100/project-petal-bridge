import { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, Clock, ExternalLink, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Profile, Run, Game, Category } from '@/lib/types';
import { formatTime, timeAgo } from '@/lib/format';
import { linkHref } from '@/lib/router';
import { Avatar } from '@/components/Avatar';

interface ProfilePageProps {
  username: string;
}

export function ProfilePage({ username }: ProfilePageProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [gameMap, setGameMap] = useState<Record<string, Game>>({});
  const [catMap, setCatMap] = useState<Record<string, Category>>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let current = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setLoadError(false);
      const { data: p, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, role, bio, avatar_url, created_at')
        .ilike('username', username.replace(/[\\%_]/g, '\\$&'))
        .maybeSingle();
      if (!current) return;
      if (profileError) throw profileError;
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile(p as Profile);

      const { data: r, error: runsError } = await supabase
        .from('runs')
        .select(
          'id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, status, rejection_reason, verified_by, verified_at, notes, created_at'
        )
        .eq('runner_id', p.id)
        .order('created_at', { ascending: false });
      if (runsError) throw runsError;
      if (!current) return;
      const runList = (r as Run[]) ?? [];
      setRuns(runList);

      const gIds = [...new Set(runList.map((x) => x.game_id))];
      const cIds = [...new Set(runList.map((x) => x.category_id))];
      if (gIds.length) {
        const { data: gs } = await supabase
          .from('games')
          .select('id, slug, title, cover_url, blurb, is_featured, created_at')
          .in('id', gIds);
        const gm: Record<string, Game> = {};
        for (const g of (gs as Game[]) ?? []) gm[g.id] = g;
        setGameMap(gm);
      }
      if (cIds.length) {
        const { data: cs } = await supabase
          .from('categories')
          .select('id, game_id, name, timing_rules, sort_order, created_at')
          .in('id', cIds);
        const cm: Record<string, Category> = {};
        for (const c of (cs as Category[]) ?? []) cm[c.id] = c;
        setCatMap(cm);
      }
      setLoading(false);
    })().catch((error) => {
      console.error('profile load failed', error);
      if (current) { setLoadError(true); setLoading(false); }
    });
    return () => { current = false; };
  }, [username]);

  if (loading) {
    return (
      <div className="sr-container py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[var(--sr-primary)] border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return <div className="sr-container py-20 text-center"><h1 className="text-2xl font-bold">Profile unavailable</h1><p className="mt-2 text-sm text-[var(--sr-text-muted)]">This runner could not be loaded right now.</p><button className="sr-btn-ghost mt-5" onClick={() => window.location.reload()}>Retry</button></div>;
  }

  if (notFound || !profile) {
    return (
      <div className="sr-container py-20 text-center">
        <Trophy className="mx-auto h-12 w-12 text-emerald-800" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-50">
          Runner not found
        </h1>
        <a href={linkHref('/games')} className="sr-btn-ghost mt-6">
          <ArrowLeft className="h-4 w-4" />
          Back to games
        </a>
      </div>
    );
  }

  const p = profile;
  const verifiedRuns = runs.filter((r) => r.status === 'verified');
  const pendingRuns = runs.filter((r) => r.status === 'pending');
  const rejectedRuns = runs.filter((r) => r.status === 'rejected');

  return (
    <div className="sr-container py-10">
      <a
        href={linkHref('/')}
        className="mb-6 inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </a>

      {/* Profile header */}
      <div className="flex flex-col gap-5 border-y border-[var(--sr-border)] py-6 sm:flex-row sm:items-center">
        <Avatar name={p.username} src={p.avatar_url} className="h-20 w-20 text-2xl sm:h-24 sm:w-24" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-emerald-50">
              {p.username}
            </h1>
            {p.role === 'owner' && (
              <span className="sr-badge bg-[var(--sr-primary)] text-[#06110a]">
                Owner
              </span>
            )}
            {p.role === 'moderator' && (
              <span className="sr-badge bg-[var(--sr-surface-2)] text-[var(--sr-primary)]">
                Moderator
              </span>
            )}
          </div>
          {p.bio && (
            <p className="mt-1 text-sm text-emerald-100/70">{p.bio}</p>
          )}
          <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
            <Calendar className="h-3 w-3" />
            Joined {timeAgo(p.created_at)}
          </p>
        </div>
        <div className="flex gap-6 border-t border-[var(--sr-border)] pt-4 text-center sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <div>
            <p className="text-2xl font-bold text-emerald-50">
              {verifiedRuns.length}
            </p>
            <p className="text-xs text-emerald-700">Verified</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-50">
              {pendingRuns.length}
            </p>
            <p className="text-xs text-emerald-700">Pending</p>
          </div>
        </div>
      </div>

      {/* Run history */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-emerald-50">Run history</h2>
        {runs.length === 0 ? (
          <div className="sr-card p-8 text-center text-emerald-700">
            No runs submitted yet.
          </div>
        ) : (
          <div className="divide-y divide-[var(--sr-border)] border-y border-[var(--sr-border)]">
            {runs.map((run) => {
              const game = gameMap[run.game_id];
              const cat = catMap[run.category_id];
              const statusStyle = {
                verified: 'bg-emerald-500/20 text-emerald-400',
                pending: 'bg-yellow-500/20 text-yellow-400',
                rejected: 'bg-red-500/20 text-red-400',
              }[run.status];

              return (
                <div
                  key={run.id}
                  className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {game && (
                        <a
                          href={linkHref(`/games/${game.slug}`)}
                          className="font-semibold text-emerald-50 hover:text-emerald-300"
                        >
                          {game.title}
                        </a>
                      )}
                      {cat && (
                        <span className="text-sm text-emerald-700">
                          — {cat.name}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 font-mono text-emerald-100">
                        <Clock className="h-3 w-3 text-[var(--sr-primary)]" />
                        {formatTime(run.time_ms)}
                      </span>
                      <span className="text-emerald-700">{run.platform}</span>
                      <span className="text-emerald-800">
                        {timeAgo(run.created_at)}
                      </span>
                    </div>
                    {run.status === 'rejected' && run.rejection_reason && (
                      <p className="mt-1 text-xs text-red-400">
                        Rejected: {run.rejection_reason}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`sr-badge ${statusStyle} capitalize`}
                    >
                      {run.status}
                    </span>
                    <a
                      href={run.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 hover:text-[var(--sr-primary)]"
                      aria-label="Watch run"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {rejectedRuns.length > 0 && (
          <p className="mt-3 text-xs text-emerald-800">
            Rejected runs are kept for your records but do not appear on
            leaderboards.
          </p>
        )}
      </div>
    </div>
  );
}
