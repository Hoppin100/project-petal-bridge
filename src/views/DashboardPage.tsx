import { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  Youtube,
  Loader2,
  Brain,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  Star,
  History,
  RefreshCw,
  Info,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type {
  Run,
  Game,
  Category,
  Profile,
  AiAssessment,
  ReferenceExample,
  AssessmentHistoryEntry,
  Recommendation,
} from '@/lib/types';
import { formatTime, timeAgo, parseYouTubeId, youtubeEmbedUrl } from '@/lib/format';
import { linkHref } from '@/lib/router';

export function DashboardPage() {
  const { profile, session } = useAuth();
  const [pendingRuns, setPendingRuns] = useState<Run[]>([]);
  const [recentRuns, setRecentRuns] = useState<Run[]>([]);
  const [gameMap, setGameMap] = useState<Record<string, Game>>({});
  const [catMap, setCatMap] = useState<Record<string, Category>>({});
  const [runnerMap, setRunnerMap] = useState<Record<string, Profile>>({});
  const [assessmentMap, setAssessmentMap] = useState<Record<string, AiAssessment>>({});
  const [refMap, setRefMap] = useState<Record<string, ReferenceExample>>({});
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [history, setHistory] = useState<AssessmentHistoryEntry[]>([]);
  const [stats, setStats] = useState({ pending: 0, verified: 0, rejected: 0, refs: 0 });

  const loadData = useCallback(async () => {
    // Pending runs (for review queue)
    const { data: pending } = await supabase
      .from('runs')
      .select(
        'id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, video_start_seconds, video_end_seconds, status, rejection_reason, verified_by, verified_at, notes, created_at'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    const pendingList = (pending as Run[]) ?? [];
    setPendingRuns(pendingList);

    // Recently decided runs
    const { data: recent } = await supabase
      .from('runs')
      .select(
        'id, game_id, category_id, runner_id, time_ms, platform, video_url, video_id, video_start_seconds, video_end_seconds, status, rejection_reason, verified_by, verified_at, notes, created_at'
      )
      .in('status', ['verified', 'rejected'])
      .order('verified_at', { ascending: false })
      .limit(10);
    setRecentRuns((recent as Run[]) ?? []);

    // Stats
    const { count: cPending } = await supabase
      .from('runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    const { count: cVerified } = await supabase
      .from('runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'verified');
    const { count: cRejected } = await supabase
      .from('runs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rejected');
    const { count: cRefs } = await supabase
      .from('reference_examples')
      .select('id', { count: 'exact', head: true });
    setStats({
      pending: cPending ?? 0,
      verified: cVerified ?? 0,
      rejected: cRejected ?? 0,
      refs: cRefs ?? 0,
    });

    const allRuns = [...pendingList, ...((recent as Run[]) ?? [])];

    // Fetch related data
    const gIds = [...new Set(allRuns.map((r) => r.game_id))];
    const cIds = [...new Set(allRuns.map((r) => r.category_id))];
    const rIds = [...new Set(allRuns.map((r) => r.runner_id))];
    const runIds = allRuns.map((r) => r.id);

    if (gIds.length) {
      const { data } = await supabase
        .from('games')
        .select('id, slug, title, cover_url, blurb, is_featured, created_at')
        .in('id', gIds);
      const m: Record<string, Game> = {};
      for (const g of (data as Game[]) ?? []) m[g.id] = g;
      setGameMap(m);
    }
    if (cIds.length) {
      const { data } = await supabase
        .from('categories')
        .select('id, game_id, name, timing_rules, sort_order, created_at')
        .in('id', cIds);
      const m: Record<string, Category> = {};
      for (const c of (data as Category[]) ?? []) m[c.id] = c;
      setCatMap(m);
    }
    if (rIds.length) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, role, bio, avatar_url, created_at')
        .in('id', rIds);
      const m: Record<string, Profile> = {};
      for (const p of (data as Profile[]) ?? []) m[p.id] = p;
      setRunnerMap(m);
    }
    if (runIds.length) {
      const { data: assess } = await supabase
        .from('ai_assessments')
        .select(
          'id, run_id, recommendation, confidence, explanation, evidence_basis, observed_evidence, speculation, model_version, input_evidence, reference_example_ids, created_at, updated_at'
        )
        .in('run_id', runIds);
      const am: Record<string, AiAssessment> = {};
      for (const a of (assess as AiAssessment[]) ?? []) am[a.run_id] = a;
      setAssessmentMap(am);

      const { data: refs } = await supabase
        .from('reference_examples')
        .select(
          'id, run_id, game_id, category_id, label, notes, marked_by, created_at'
        )
        .in('run_id', runIds);
      const rm: Record<string, ReferenceExample> = {};
      for (const r of (refs as ReferenceExample[]) ?? []) rm[r.run_id] = r;
      setRefMap(rm);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (session && profile?.role !== 'owner') {
      setLoading(false);
      return;
    }
    if (!session) {
      setLoading(false);
      return;
    }
    void loadData();
  }, [session, profile, loadData]);

  // Load history for selected run
  useEffect(() => {
    if (!selectedRunId) {
      setHistory([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('assessment_history')
        .select('id, run_id, action, detail, actor_id, created_at')
        .eq('run_id', selectedRunId)
        .order('created_at', { ascending: false })
        .limit(20);
      setHistory((data as AssessmentHistoryEntry[]) ?? []);
    })();
  }, [selectedRunId]);

  async function handleVerify(runId: string) {
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('verify_run', { p_run: runId });
      if (error) throw error;
      await loadData();
    } catch (e) {
      console.error('verify failed', e);
      alert('Could not verify run. You may not have owner permissions.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(runId: string) {
    if (!rejectReason.trim()) {
      alert('Please provide a rejection reason.');
      return;
    }
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('reject_run', {
        p_run: runId,
        p_reason: rejectReason.trim(),
      });
      if (error) throw error;
      setRejectReason('');
      await loadData();
    } catch (e) {
      console.error('reject failed', e);
      alert('Could not reject run.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteRun(runId: string) {
    if (!confirm('Permanently delete this run and its review history? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('delete_run', { p_run: runId });
      if (error) throw error;
      setSelectedRunId(null);
      await loadData();
    } catch (e) {
      console.error('delete run failed', e);
      alert('Could not delete run. Make sure the database migration has been applied.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleToggleReference(run: Run, currentLabel?: 'verified' | 'rejected') {
    setActionLoading(true);
    try {
      if (currentLabel) {
        // Remove
        const { error } = await supabase
          .from('reference_examples')
          .delete()
          .eq('run_id', run.id);
        if (error) throw error;
      } else {
        // Add as reference (label follows the run's current status, or verified if pending)
        const label = run.status === 'rejected' ? 'rejected' : 'verified';
        const { error } = await supabase.from('reference_examples').insert({
          run_id: run.id,
          game_id: run.game_id,
          category_id: run.category_id,
          label,
          notes: feedbackNote.trim() || null,
          marked_by: profile?.id,
        });
        if (error) throw error;
        setFeedbackNote('');
      }
      await loadData();
    } catch (e) {
      console.error('ref toggle failed', e);
      alert('Could not update reference example.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRegenerate(runId: string) {
    setActionLoading(true);
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-run`;
      const resp = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ runId }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      await loadData();
    } catch (e) {
      console.error('regenerate failed', e);
      alert('AI assessment service unavailable. Run remains pending for manual review.');
    } finally {
      setActionLoading(false);
    }
  }

  if (!session) {
    return (
      <div className="sr-container py-20 text-center">
        <p className="text-emerald-100">Sign in to access the dashboard.</p>
      </div>
    );
  }

  if (profile?.role !== 'owner') {
    return (
      <div className="sr-container py-20 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-emerald-800" />
        <h1 className="mt-4 text-2xl font-bold text-emerald-50">Owners only</h1>
        <p className="mt-2 text-sm text-emerald-700">
          The verification dashboard is restricted to authorized owner accounts.
        </p>
      </div>
    );
  }

  const selectedRun = pendingRuns.find((r) => r.id === selectedRunId) ??
    recentRuns.find((r) => r.id === selectedRunId) ?? null;

  return (
    <div className="sr-container py-10">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold text-emerald-50">
          <ShieldCheck className="h-7 w-7 text-[var(--sr-primary)]" />
          Verification Dashboard
        </h1>
        <p className="mt-1 text-sm text-emerald-700">
          Review submissions with the SplitRush Verification Assistant.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pending" value={stats.pending} color="text-yellow-400" />
        <StatCard label="Verified" value={stats.verified} color="text-emerald-400" />
        <StatCard label="Rejected" value={stats.rejected} color="text-red-400" />
        <StatCard label="Reference examples" value={stats.refs} color="text-blue-400" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Queue list */}
        <div className="lg:col-span-1">
          <div className="mb-3 flex gap-2">
            <button
              onClick={() => setTab('pending')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === 'pending'
                  ? 'bg-[var(--sr-primary)] text-[#06110a]'
                  : 'border border-[var(--sr-border)] text-emerald-100'
              }`}
            >
              Pending ({pendingRuns.length})
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                tab === 'history'
                  ? 'bg-[var(--sr-primary)] text-[#06110a]'
                  : 'border border-[var(--sr-border)] text-emerald-100'
              }`}
            >
              Recent ({recentRuns.length})
            </button>
          </div>

          {loading ? (
            <div className="sr-card p-8 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--sr-primary)]" />
            </div>
          ) : tab === 'pending' ? (
            pendingRuns.length === 0 ? (
              <div className="sr-card p-6 text-center text-sm text-emerald-700">
                No pending submissions. All caught up!
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {pendingRuns.map((run) => (
                  <RunListItem
                    key={run.id}
                    run={run}
                    game={gameMap[run.game_id]}
                    category={catMap[run.category_id]}
                    runner={runnerMap[run.runner_id]}
                    assessment={assessmentMap[run.id]}
                    selected={selectedRunId === run.id}
                    onClick={() => setSelectedRunId(run.id)}
                  />
                ))}
              </div>
            )
          ) : recentRuns.length === 0 ? (
            <div className="sr-card p-6 text-center text-sm text-emerald-700">
              No reviewed runs yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentRuns.map((run) => (
                <RunListItem
                  key={run.id}
                  run={run}
                  game={gameMap[run.game_id]}
                  category={catMap[run.category_id]}
                  runner={runnerMap[run.runner_id]}
                  assessment={assessmentMap[run.id]}
                  selected={selectedRunId === run.id}
                  onClick={() => setSelectedRunId(run.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {!selectedRun ? (
            <div className="sr-card flex flex-col items-center justify-center p-12 text-center">
              <Brain className="h-12 w-12 text-emerald-800" />
              <p className="mt-3 text-emerald-100">Select a submission to review</p>
              <p className="text-sm text-emerald-700">
                View the AI assessment, watch the proof video, and make a decision.
              </p>
            </div>
          ) : (
            <RunDetailPanel
              key={selectedRun.id}
              run={selectedRun}
              game={gameMap[selectedRun.game_id]}
              category={catMap[selectedRun.category_id]}
              runner={runnerMap[selectedRun.runner_id]}
              assessment={assessmentMap[selectedRun.id]}
              refExample={refMap[selectedRun.id]}
              history={history}
              actionLoading={actionLoading}
              rejectReason={rejectReason}
              feedbackNote={feedbackNote}
              onRejectReasonChange={setRejectReason}
              onFeedbackNoteChange={setFeedbackNote}
              onVerify={() => handleVerify(selectedRun.id)}
              onReject={() => handleReject(selectedRun.id)}
              onDelete={() => handleDeleteRun(selectedRun.id)}
              onRegenerate={() => handleRegenerate(selectedRun.id)}
              onToggleRef={() => handleToggleReference(selectedRun, refMap[selectedRun.id]?.label)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="sr-card p-4">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-emerald-700">{label}</p>
    </div>
  );
}

function RunListItem({
  run,
  game,
  category,
  runner,
  assessment,
  selected,
  onClick,
}: {
  run: Run;
  game?: Game;
  category?: Category;
  runner?: Profile;
  assessment?: AiAssessment;
  selected: boolean;
  onClick: () => void;
}) {
  const recIcon = assessment ? recIconFor(assessment.recommendation) : null;
  const statusBadge = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    verified: 'bg-emerald-500/20 text-emerald-400',
    rejected: 'bg-red-500/20 text-red-400',
  }[run.status];

  return (
    <button
      onClick={onClick}
      className={`sr-card p-3 text-left transition-all ${
        selected
          ? 'border-[var(--sr-primary)] shadow-[0_0_12px_var(--sr-primary-glow)]'
          : 'hover:border-[var(--sr-primary)]/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-emerald-50">
          {game?.title ?? 'Unknown game'}
        </span>
        <span className={`sr-badge ${statusBadge} capitalize flex-shrink-0`}>
          {run.status}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-emerald-700">
        <span>{category?.name}</span>
        <span>·</span>
        <span>{runner?.username ?? 'Unknown'}</span>
        <span>·</span>
        <span className="font-mono text-emerald-100">{formatTime(run.time_ms)}</span>
      </div>
      {assessment && recIcon && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {recIcon}
          <span className={recColorFor(assessment.recommendation)}>
            {recLabelFor(assessment.recommendation)}
          </span>
          {assessment.confidence !== null && (
            <span className="text-emerald-800">
              · {(assessment.confidence * 100).toFixed(0)}% conf.
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function RunDetailPanel({
  run,
  game,
  category,
  runner,
  assessment,
  refExample,
  history,
  actionLoading,
  rejectReason,
  feedbackNote,
  onRejectReasonChange,
  onFeedbackNoteChange,
  onVerify,
  onReject,
  onDelete,
  onRegenerate,
  onToggleRef,
}: {
  run: Run;
  game?: Game;
  category?: Category;
  runner?: Profile;
  assessment?: AiAssessment;
  refExample?: ReferenceExample;
  history: AssessmentHistoryEntry[];
  actionLoading: boolean;
  rejectReason: string;
  feedbackNote: string;
  onRejectReasonChange: (v: string) => void;
  onFeedbackNoteChange: (v: string) => void;
  onVerify: () => void;
  onReject: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onToggleRef: () => void;
}) {
  const [videoMarker, setVideoMarker] = useState<'start' | 'finish' | null>(null);
  const videoId = parseYouTubeId(run.video_url);
  const markerSeconds = videoMarker === 'start'
    ? run.video_start_seconds
    : videoMarker === 'finish'
      ? run.video_end_seconds
      : null;
  const embedUrl = videoId
    ? `${youtubeEmbedUrl(videoId)}${markerSeconds !== null ? `?start=${markerSeconds}` : ''}`
    : '';

  return (
    <div className="flex flex-col gap-4">
      {/* Run header */}
      <div className="sr-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold text-emerald-50">
                {game?.title ?? 'Unknown game'}
              </h2>
              {game && (
                <a
                  href={linkHref(`/games/${game.slug}`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--sr-primary)] hover:text-white"
                >
                  View game page
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <p className="text-sm text-emerald-700">
              {category?.name} · {runner?.username ?? 'Unknown runner'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono text-2xl font-bold text-[var(--sr-primary)]">
              {formatTime(run.time_ms)}
            </p>
            <p className="text-xs text-emerald-700">
              {run.platform} · {timeAgo(run.created_at)}
            </p>
          </div>
        </div>
        {category?.timing_rules && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--sr-border)] bg-[var(--sr-surface-2)] p-3 text-sm text-emerald-100/80">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--sr-primary)]" />
            <div>
              <span className="font-semibold text-emerald-50">Category rules: </span>
              {category.timing_rules}
            </div>
          </div>
        )}
        {run.notes && (
          <p className="mt-3 text-sm text-emerald-100/70">
            <span className="font-semibold">Runner notes: </span>
            {run.notes}
          </p>
        )}
      </div>

      {/* Video proof */}
      <div className="sr-card overflow-hidden p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Youtube className="h-5 w-5 text-red-500" />
          <h3 className="font-semibold text-emerald-50">Video proof</h3>
          <a
            href={run.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto min-h-10 text-sm text-[var(--sr-primary)] hover:text-emerald-300"
          >
            Open on YouTube
          </a>
        </div>
        {(run.video_start_seconds !== null || run.video_end_seconds !== null) && (
          <div className="mb-3 flex flex-wrap gap-2">
            {run.video_start_seconds !== null && (
              <button type="button" onClick={() => setVideoMarker('start')} className={`sr-btn-ghost min-h-10 ${videoMarker === 'start' ? 'border-[var(--sr-primary)] text-[var(--sr-primary)]' : ''}`}>
                Run start · {formatVideoMarker(run.video_start_seconds)}
              </button>
            )}
            {run.video_end_seconds !== null && (
              <button type="button" onClick={() => setVideoMarker('finish')} className={`sr-btn-ghost min-h-10 ${videoMarker === 'finish' ? 'border-[var(--sr-primary)] text-[var(--sr-primary)]' : ''}`}>
                Run finish · {formatVideoMarker(run.video_end_seconds)}
              </button>
            )}
            <button type="button" onClick={() => setVideoMarker(null)} className="sr-btn-ghost min-h-10">Play from beginning</button>
          </div>
        )}
        {videoId ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <iframe
              src={embedUrl}
              title="Run proof"
              className="h-full w-full"
              allowFullScreen
            />
          </div>
        ) : (
          <p className="text-sm text-red-400">
            Invalid YouTube URL. Cannot embed video.
          </p>
        )}
      </div>

      {/* AI Assessment */}
      {assessment ? (
        <AssessmentCard assessment={assessment} onRegenerate={onRegenerate} actionLoading={actionLoading} />
      ) : (
        <div className="sr-card p-5">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-emerald-800" />
            <h3 className="font-semibold text-emerald-50">AI Assessment</h3>
          </div>
          <p className="mt-2 text-sm text-emerald-700">
            No AI assessment yet. The assistant will evaluate this run when
            triggered, or you can review it manually.
          </p>
          <button
            onClick={onRegenerate}
            disabled={actionLoading}
            className="sr-btn-ghost mt-3"
          >
            {actionLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Generate assessment
          </button>
        </div>
      )}

      {/* Owner actions */}
      <div className="sr-card p-5">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-emerald-50">
          <ShieldCheck className="h-5 w-5 text-[var(--sr-primary)]" />
          Owner decision
        </h3>

        {run.status === 'pending' ? (
          <>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={onVerify}
                disabled={actionLoading}
                className="sr-btn-primary"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Verify run
              </button>
              <button
                onClick={onReject}
                disabled={actionLoading || !rejectReason.trim()}
                className="sr-btn-ghost border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
                Reject run
              </button>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs text-emerald-700">
                Rejection reason (required to reject)
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => onRejectReasonChange(e.target.value)}
                placeholder="e.g. Timer not visible, wrong category..."
                className="sr-input"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="sr-badge capitalize bg-[var(--sr-surface-2)] text-emerald-100">
              {run.status}
            </span>
            {run.rejection_reason && (
              <span className="text-red-400">Reason: {run.rejection_reason}</span>
            )}
          </div>
        )}

        <button
          onClick={onDelete}
          disabled={actionLoading}
          className="sr-btn-ghost mt-4 border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          Delete run permanently
        </button>

        {/* Reference example management */}
        <div className="mt-4 border-t border-[var(--sr-border)] pt-4">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-100">
              <Star className="h-4 w-4 text-yellow-400" />
              Reference example
            </h4>
            <button
              onClick={onToggleRef}
              disabled={actionLoading}
              className={`text-xs font-semibold ${
                refExample
                  ? 'text-red-400 hover:text-red-300'
                  : 'text-[var(--sr-primary)] hover:text-emerald-300'
              }`}
            >
              {refExample ? 'Remove as reference' : 'Mark as reference'}
            </button>
          </div>
          <p className="mt-1 text-xs text-emerald-700">
            {refExample
              ? `Labeled as "${refExample.label}". Used by the AI as a training example.`
              : 'Marking this run as a reference example helps the AI learn what compliant runs look like for this game and category.'}
          </p>
          {!refExample && (
            <input
              type="text"
              value={feedbackNote}
              onChange={(e) => onFeedbackNoteChange(e.target.value)}
              placeholder="Optional note for the AI (e.g. why this is a good example)"
              className="sr-input mt-2"
            />
          )}
        </div>
      </div>

      {/* Assessment history */}
      {history.length > 0 && (
        <div className="sr-card p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-emerald-50">
            <History className="h-5 w-5 text-emerald-700" />
            Assessment history
          </h3>
          <div className="flex flex-col gap-2">
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between border-b border-[var(--sr-border)]/50 pb-2 text-sm last:border-0"
              >
                <span className="text-emerald-100">{formatAction(h.action)}</span>
                <span className="text-xs text-emerald-700">
                  {timeAgo(h.created_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatVideoMarker(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function AssessmentCard({
  assessment,
  onRegenerate,
  actionLoading = false,
}: {
  assessment: AiAssessment;
  onRegenerate?: () => void;
  actionLoading?: boolean;
}) {
  const recIcon = recIconFor(assessment.recommendation);
  const basisLabel = {
    video_analysis: 'Video analysis',
    metadata: 'Metadata',
    statistical: 'Statistical comparison',
    incomplete: 'Incomplete evidence',
  }[assessment.evidence_basis];

  return (
    <div className="sr-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[var(--sr-primary)]" />
          <h3 className="font-semibold text-emerald-50">
            SplitRush Verification Assistant
          </h3>
        </div>
        <button
          className="sr-btn-ghost text-xs"
          onClick={() => onRegenerate?.()}
          disabled={actionLoading}
        >
          {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Regenerate
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold bg-[var(--sr-surface-2)]">
          {recIcon}
          <span className={recColorFor(assessment.recommendation)}>
            {recLabelFor(assessment.recommendation)}
          </span>
        </span>
        {assessment.confidence !== null && (
          <span className="text-xs text-emerald-700">
            Confidence: {(assessment.confidence * 100).toFixed(0)}%
          </span>
        )}
        <span className="text-xs text-emerald-700">Basis: {basisLabel}</span>
        <span className="text-xs text-emerald-800">
          Model: {assessment.model_version}
        </span>
      </div>

      <div className="mt-3 whitespace-pre-wrap rounded-lg border border-[var(--sr-border)] bg-[var(--sr-surface-2)] p-3 text-sm text-emerald-100/80">
        {assessment.explanation}
      </div>

      <p className="mt-3 text-xs text-emerald-800">
        This is an AI recommendation, not an official verification status. The
        AI does not analyze video frames and cannot approve runs on its own.
        Owners make the final decision.
      </p>
    </div>
  );
}

function recIconFor(rec: Recommendation) {
  if (rec === 'likely_consistent')
    return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (rec === 'needs_review')
    return <HelpCircle className="h-4 w-4 text-yellow-400" />;
  return <AlertTriangle className="h-4 w-4 text-red-400" />;
}

function recColorFor(rec: Recommendation): string {
  if (rec === 'likely_consistent') return 'text-emerald-400';
  if (rec === 'needs_review') return 'text-yellow-400';
  return 'text-red-400';
}

function recLabelFor(rec: Recommendation): string {
  return {
    likely_consistent: 'Likely consistent',
    needs_review: 'Needs review',
    potential_concern: 'Potential concern',
  }[rec];
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
