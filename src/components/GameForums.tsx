import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Flag,
  Loader2,
  Lock,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Unlock,
  X,
} from 'lucide-react';
import type { ForumCategory, ForumPost, ForumReport, ForumThread, Game } from '@/lib/types';
import {
  FORUM_CATEGORIES,
  acceptAnswer,
  buildPostTree,
  createReply,
  createThread,
  deletePost,
  deleteThread,
  fetchGameThreads,
  fetchMyForumVotes,
  fetchOpenReports,
  fetchThread,
  fetchThreadPosts,
  filterThreads,
  forumCategoryLabel,
  reportContent,
  resolveReport,
  setThreadFlags,
  sortThreads,
  updatePost,
  updateThread,
  votePost,
  voteThread,
  type ForumSort,
} from '@/lib/forums';
import { useAuth } from '@/lib/auth';
import { useOpenAuth } from '@/lib/auth-modal';
import { Avatar } from '@/components/Avatar';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { FormattedText } from '@/components/FormattedText';
import { timeAgo } from '@/lib/format';

type ForumView = { kind: 'list' } | { kind: 'compose' } | { kind: 'thread'; threadId: string };

function isStaff(role: string | undefined) {
  return role === 'owner' || role === 'moderator';
}

function voteKeyThread(id: string) {
  return `t:${id}`;
}

function voteKeyPost(id: string) {
  return `p:${id}`;
}

export function GameForums({ game }: { game: Game }) {
  const { profile } = useAuth();
  const openAuth = useOpenAuth();
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [migrationMissing, setMigrationMissing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ForumCategory | 'all'>('all');
  const [sort, setSort] = useState<ForumSort>('newest');
  const [view, setView] = useState<ForumView>({ kind: 'list' });
  const [votes, setVotes] = useState<Map<string, number>>(new Map());
  const [notice, setNotice] = useState('');
  const [reports, setReports] = useState<ForumReport[]>([]);
  const [reportActionError, setReportActionError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const result = await fetchGameThreads(game.id);
    setThreads(result.threads);
    setMigrationMissing(result.migrationMissing);
    setLoadError(result.error ?? '');
    if (isStaff(profile?.role)) {
      const reportResult = await fetchOpenReports(game.id);
      setReports(reportResult.reports);
    } else {
      setReports([]);
    }
    setLoading(false);
  }, [game.id, profile?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!profile) {
      setVotes(new Map());
      return;
    }
    let cancelled = false;
    void fetchMyForumVotes(profile.id).then((map) => {
      if (!cancelled) setVotes(map);
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  function setVote(key: string, value: number) {
    setVotes((current) => {
      const copy = new Map(current);
      if (value === 0) copy.delete(key);
      else copy.set(key, value);
      return copy;
    });
  }

  async function handleResolveReport(reportId: string, status: 'reviewed' | 'dismissed') {
    if (!profile) return;
    setReportActionError('');
    const resolveError = await resolveReport(reportId, status, profile.id);
    if (resolveError) {
      setReportActionError(resolveError);
      return;
    }
    setReports((current) => current.filter((report) => report.id !== reportId));
  }

  const visibleThreads = useMemo(
    () => sortThreads(filterThreads(threads, { search, category }), sort),
    [threads, search, category, sort],
  );

  if (view.kind === 'compose') {
    if (!profile) {
      return <ForumSignIn onSignIn={() => openAuth('signin')} message="Sign in to start a discussion." />;
    }
    return (
      <ThreadComposer
        game={game}
        authorId={profile.id}
        onCancel={() => setView({ kind: 'list' })}
        onCreated={async (threadId) => {
          await load();
          setNotice('Discussion started.');
          setView({ kind: 'thread', threadId });
        }}
      />
    );
  }

  if (view.kind === 'thread') {
    return (
      <ThreadView
        threadId={view.threadId}
        profile={profile}
        myVotes={votes}
        onVote={setVote}
        onBack={async () => {
          setView({ kind: 'list' });
          await load();
        }}
        onThreadChanged={() => void load()}
        openAuth={() => openAuth('signin')}
      />
    );
  }

  return (
    <section aria-label={`${game.title} forum`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sr-eyebrow flex items-center gap-2">
            <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
            Forums
          </p>
          <h2 className="text-lg font-bold">Game discussion</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--sr-text-muted)]">
            Ask questions, share strategies, and talk about {game.title} with other players.
          </p>
        </div>
        <button
          type="button"
          className="sr-btn-primary"
          onClick={() => {
            if (!profile) {
              openAuth('signin');
              return;
            }
            setView({ kind: 'compose' });
          }}
        >
          <Plus className="h-4 w-4" />
          New discussion
        </button>
      </div>

      {notice && (
        <p role="status" className="mb-3 border-l-2 border-[var(--sr-primary)] bg-[var(--sr-surface)] px-3 py-2 text-sm text-[var(--sr-text-dim)]">
          {notice}
        </p>
      )}

      {loadError && (
        <p role="alert" className="mb-3 rounded-sm border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
          {loadError}
        </p>
      )}

      {isStaff(profile?.role) && reports.length > 0 && (
        <details className="mb-4 border border-[var(--sr-border)] bg-[var(--sr-surface)]">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm font-semibold text-[var(--sr-text)]">
            <ShieldAlert aria-hidden="true" className="h-4 w-4 text-[var(--sr-primary)]" />
            Reported content
            <span className="sr-badge bg-[var(--sr-primary)]/10 text-[var(--sr-primary)]">
              {reports.length} open
            </span>
          </summary>
          <div className="border-t border-[var(--sr-border)]">
            {reportActionError && (
              <p role="alert" className="border-b border-[var(--sr-border)] px-3 py-2 text-sm text-[var(--sr-danger)]">
                {reportActionError}
              </p>
            )}
            <ul className="divide-y divide-[var(--sr-border)]">
              {reports.map((report) => (
                <li key={report.id} className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--sr-text-muted)]">
                    <span className="font-semibold text-[var(--sr-text-dim)]">
                      {report.post_id ? 'Reply' : 'Thread'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>reported by {report.reporter?.username ?? 'a member'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{timeAgo(report.created_at)}</span>
                  </div>
                  <p className="mt-1 break-words text-sm text-[var(--sr-text)]">{report.reason}</p>
                  {report.post_excerpt && (
                    <p className="mt-1 break-words border-l-2 border-[var(--sr-border)] pl-2 text-xs text-[var(--sr-text-muted)]">
                      “{report.post_excerpt}”
                    </p>
                  )}
                  {report.thread_title && (
                    <button
                      type="button"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--sr-link)] hover:underline"
                      onClick={() => {
                        const id = report.target_thread_id ?? report.thread_id;
                        if (id) setView({ kind: 'thread', threadId: id });
                      }}
                    >
                      Open “{report.thread_title}”
                    </button>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="sr-btn-ghost text-xs"
                      onClick={() => void handleResolveReport(report.id, 'reviewed')}
                    >
                      Mark reviewed
                    </button>
                    <button
                      type="button"
                      className="sr-btn-ghost text-xs"
                      onClick={() => void handleResolveReport(report.id, 'dismissed')}
                    >
                      Dismiss
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </details>
      )}

      {migrationMissing ? (
        <div className="sr-panel p-6 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-[var(--sr-text-muted)]" />
          <p className="mt-3 font-semibold text-[var(--sr-text)]">Forums are not available yet</p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--sr-text-muted)]">
            Apply <span className="sr-mono">drizzle/migrations/0010_guides_and_forums.sql</span> to
            the project database to enable game forums.
          </p>
        </div>
      ) : loading ? (
        <div className="sr-panel flex items-center justify-center py-12 text-[var(--sr-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Loading discussions" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 border-b border-[var(--sr-border)] pb-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sr-text-muted)]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search discussions"
                aria-label="Search discussions"
                className="sr-input pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="forum-category-filter">
                Forum category
              </label>
              <select
                id="forum-category-filter"
                value={category}
                onChange={(event) => setCategory(event.target.value as ForumCategory | 'all')}
                className="sr-input w-auto min-w-[9rem]"
              >
                <option value="all">All categories</option>
                {FORUM_CATEGORIES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="forum-sort">
                Sort discussions
              </label>
              <select
                id="forum-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as ForumSort)}
                className="sr-input w-auto min-w-[8rem]"
              >
                <option value="newest">Newest</option>
                <option value="active">Recently active</option>
                <option value="top">Top voted</option>
              </select>
            </div>
          </div>

          {visibleThreads.length === 0 ? (
            <div className="sr-panel px-4 py-10 text-center">
              <MessageSquare className="mx-auto h-8 w-8 text-[var(--sr-text-muted)]" />
              <p className="mt-3 font-semibold text-[var(--sr-text)]">
                {threads.length === 0 ? 'No discussions yet' : 'No discussions match those filters'}
              </p>
              <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
                {threads.length === 0
                  ? 'Start the first conversation about this game.'
                  : 'Try a different search term or category.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--sr-border)] border border-[var(--sr-border)] bg-[var(--sr-surface)]">
              {visibleThreads.map((thread) => (
                <li key={thread.id}>
                  <button
                    type="button"
                    onClick={() => setView({ kind: 'thread', threadId: thread.id })}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--sr-surface-2)] sm:px-4"
                  >
                    <span className="sr-mono flex w-10 flex-shrink-0 flex-col items-center pt-1 text-xs text-[var(--sr-text-muted)]">
                      <ArrowUp aria-hidden="true" className="h-3.5 w-3.5" />
                      <span className="font-semibold text-[var(--sr-text)]">{thread.score}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {thread.is_pinned && (
                          <span className="sr-badge bg-[var(--sr-primary)]/10 text-[var(--sr-primary)]">
                            <Pin aria-hidden="true" className="h-3 w-3" />
                            Pinned
                          </span>
                        )}
                        {thread.is_locked && (
                          <span className="sr-badge bg-[var(--sr-surface-2)] text-[var(--sr-text-dim)]">
                            <Lock aria-hidden="true" className="h-3 w-3" />
                            Locked
                          </span>
                        )}
                        {thread.is_solved && (
                          <span className="sr-badge bg-[var(--sr-ok-bg)] text-[var(--sr-primary)]">
                            <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                            Solved
                          </span>
                        )}
                        <span className="text-xs text-[var(--sr-text-muted)]">
                          {forumCategoryLabel(thread.category)}
                        </span>
                      </div>
                      <p className="mt-1 break-words font-semibold text-[var(--sr-text)]">
                        {thread.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--sr-text-muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar
                            name={thread.author?.username ?? 'Member'}
                            src={thread.author?.avatar_url ?? null}
                            className="h-4 w-4 text-[8px]"
                          />
                          {thread.author?.username ?? 'Member'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{timeAgo(thread.created_at)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                          {thread.reply_count ?? 0}{' '}
                          {(thread.reply_count ?? 0) === 1 ? 'reply' : 'replies'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function ForumSignIn({ message, onSignIn }: { message: string; onSignIn: () => void }) {
  return (
    <div className="sr-panel px-4 py-10 text-center">
      <MessageSquare className="mx-auto h-8 w-8 text-[var(--sr-primary)]" />
      <p className="mt-3 font-semibold text-[var(--sr-text)]">{message}</p>
      <button type="button" className="sr-btn-primary mt-4" onClick={onSignIn}>
        Sign in
      </button>
    </div>
  );
}

function ThreadComposer({
  game,
  authorId,
  onCancel,
  onCreated,
}: {
  game: Game;
  authorId: string;
  onCancel: () => void;
  onCreated: (threadId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ForumCategory>('general');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!title.trim()) {
      setError('Give the discussion a title.');
      return;
    }
    if (!body.trim()) {
      setError('Add a message so other players know what you want to discuss.');
      return;
    }
    setSubmitting(true);
    const result = await createThread({
      gameId: game.id,
      authorId,
      title,
      body,
      category,
    });
    setSubmitting(false);
    if (result.error || !result.threadId) {
      setError(result.error ?? 'Could not start the discussion.');
      return;
    }
    await onCreated(result.threadId);
  }

  return (
    <section aria-label="New discussion">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="sr-eyebrow">Forums</p>
          <h2 className="text-xl font-bold">New discussion</h2>
        </div>
        <button type="button" onClick={onCancel} className="sr-btn-ghost">
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
      <form onSubmit={submit} className="sr-panel flex flex-col gap-4 p-4 sm:p-5">
        <div>
          <label htmlFor="thread-title" className="mb-1 block text-sm font-medium">
            Title <span className="text-[var(--sr-primary)]">Required</span>
          </label>
          <input
            id="thread-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="sr-input"
            placeholder="What do you want to talk about?"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="thread-category" className="mb-1 block text-sm font-medium">
            Category
          </label>
          <select
            id="thread-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as ForumCategory)}
            className="sr-input"
          >
            {FORUM_CATEGORIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="thread-body" className="mb-1 block text-sm font-medium">
            Message <span className="text-[var(--sr-primary)]">Required</span>
          </label>
          <textarea
            id="thread-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={7}
            className="sr-input resize-y"
            placeholder="Share the details, your route, or the question you need answered."
          />
        </div>
        {error && (
          <p role="alert" className="rounded-sm border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--sr-border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="sr-btn-ghost">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="sr-btn-primary">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Post discussion
          </button>
        </div>
      </form>
    </section>
  );
}

function ThreadView({
  threadId,
  profile,
  myVotes,
  onVote,
  onBack,
  onThreadChanged,
  openAuth,
}: {
  threadId: string;
  profile: { id: string; role: string } | null;
  myVotes: Map<string, number>;
  onVote: (key: string, value: number) => void;
  onBack: () => Promise<void>;
  onThreadChanged: () => void;
  openAuth: () => void;
}) {
  const [thread, setThread] = useState<ForumThread | null>(null);
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [replyPostId, setReplyPostId] = useState<string | null>(null);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [editingThread, setEditingThread] = useState(false);
  const [threadTitle, setThreadTitle] = useState('');
  const [threadBody, setThreadBody] = useState('');
  const [threadCategory, setThreadCategory] = useState<ForumCategory>('general');
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingPostBody, setEditingPostBody] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reportOpen, setReportOpen] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportNotice, setReportNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [threadResult, postsResult] = await Promise.all([
      fetchThread(threadId),
      fetchThreadPosts(threadId),
    ]);
    setThread(threadResult.thread);
    setPosts(postsResult.posts);
    setError(threadResult.error ?? postsResult.error ?? '');
    if (threadResult.thread) {
      setThreadTitle(threadResult.thread.title);
      setThreadBody(threadResult.thread.body);
      setThreadCategory(threadResult.thread.category);
    }
    setLoading(false);
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--sr-text-muted)]" aria-label="Loading discussion" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="sr-panel px-4 py-10 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-[var(--sr-text-muted)]" />
        <p className="mt-3 font-semibold text-[var(--sr-text)]">Discussion not found</p>
        {error && <p className="mt-1 text-sm text-[var(--sr-danger)]">{error}</p>}
        <button type="button" className="sr-btn-ghost mt-4" onClick={() => void onBack()}>
          <ArrowLeft className="h-4 w-4" />
          Back to discussions
        </button>
      </div>
    );
  }

  const staff = isStaff(profile?.role);
  const mine = profile?.id === thread.author_id;
  const canAccept = staff || mine;
  const threadVote = myVotes.get(voteKeyThread(thread.id)) ?? 0;
  const tree = buildPostTree(posts);

  async function handleThreadVote(value: -1 | 1) {
    if (!profile) {
      openAuth();
      return;
    }
    const next = threadVote === value ? 0 : value;
    const voteError = await voteThread(thread!.id, next);
    if (voteError) {
      setError(voteError);
      return;
    }
    onVote(voteKeyThread(thread!.id), next);
    setThread((current) =>
      current ? { ...current, score: current.score - threadVote + next } : current,
    );
  }

  async function handlePostVote(post: ForumPost, value: -1 | 1) {
    if (!profile) {
      openAuth();
      return;
    }
    const currentVote = myVotes.get(voteKeyPost(post.id)) ?? 0;
    const next = currentVote === value ? 0 : value;
    const voteError = await votePost(post.id, next);
    if (voteError) {
      setError(voteError);
      return;
    }
    onVote(voteKeyPost(post.id), next);
    setPosts((current) =>
      current.map((item) =>
        item.id === post.id ? { ...item, score: item.score - currentVote + next } : item,
      ),
    );
  }

  async function submitReply(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) {
      openAuth();
      return;
    }
    if (!replyBody.trim()) return;
    setReplySubmitting(true);
    const result = await createReply({
      threadId: thread!.id,
      authorId: profile.id,
      body: replyBody,
      parentPostId: replyPostId,
    });
    setReplySubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setReplyBody('');
    setReplyPostId(null);
    setReplyTo(null);
    await load();
    onThreadChanged();
  }

  async function saveThreadEdits() {
    const saveError = await updateThread(thread!.id, {
      title: threadTitle,
      body: threadBody,
      category: threadCategory,
    });
    if (saveError) {
      setError(saveError);
      return;
    }
    setEditingThread(false);
    await load();
  }

  async function handleReport(target: { threadId?: string; postId?: string }) {
    if (!profile) {
      openAuth();
      return;
    }
    if (!reportReason.trim()) return;
    const reportError = await reportContent({
      reporterId: profile.id,
      reason: reportReason,
      threadId: target.threadId ?? null,
      postId: target.postId ?? null,
    });
    if (reportError) {
      setError(reportError);
      return;
    }
    setReportOpen(null);
    setReportReason('');
    setReportNotice('Thanks — this has been reported for review.');
  }

  function renderPost(post: ForumPost, depth: number) {
    const postVote = myVotes.get(voteKeyPost(post.id)) ?? 0;
    const accepted = thread!.accepted_post_id === post.id;
    const canEditPost = profile?.id === post.author_id;
    return (
      <li key={post.id} className="list-none">
        <div
          className={`border-l-2 py-3 pl-3 ${
            accepted ? 'border-[var(--sr-primary)] bg-[var(--sr-primary)]/5' : 'border-[var(--sr-border)]'
          }`}
          style={{ marginLeft: depth === 0 ? 0 : Math.min(depth, 3) * 12 }}
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--sr-text-muted)]">
            <Avatar
              name={post.author?.username ?? 'Member'}
              src={post.author?.avatar_url ?? null}
              className="h-5 w-5 text-[9px]"
            />
            <span className="font-semibold text-[var(--sr-text)]">
              {post.author?.username ?? 'Member'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{timeAgo(post.created_at)}</span>
            {accepted && (
              <span className="sr-badge bg-[var(--sr-ok-bg)] text-[var(--sr-primary)]">
                <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                Accepted answer
              </span>
            )}
          </div>

          {editingPostId === post.id ? (
            <div className="mt-2">
              <textarea
                value={editingPostBody}
                onChange={(event) => setEditingPostBody(event.target.value)}
                rows={4}
                className="sr-input resize-y"
                aria-label="Edit reply"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="sr-btn-primary"
                  onClick={async () => {
                    const saveError = await updatePost(post.id, editingPostBody);
                    if (saveError) {
                      setError(saveError);
                      return;
                    }
                    setEditingPostId(null);
                    await load();
                  }}
                >
                  Save
                </button>
                <button type="button" className="sr-btn-ghost" onClick={() => setEditingPostId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <FormattedText text={post.body} />
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <div className="inline-flex items-center border border-[var(--sr-border)]">
              <button
                type="button"
                onClick={() => void handlePostVote(post, 1)}
                aria-pressed={postVote === 1}
                aria-label="Upvote reply"
                className={`p-1.5 hover:text-[var(--sr-primary)] ${postVote === 1 ? 'text-[var(--sr-primary)]' : 'text-[var(--sr-text-muted)]'}`}
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <span className="sr-mono min-w-6 text-center text-[var(--sr-text)]">{post.score}</span>
              <button
                type="button"
                onClick={() => void handlePostVote(post, -1)}
                aria-pressed={postVote === -1}
                aria-label="Downvote reply"
                className={`p-1.5 hover:text-[var(--sr-danger)] ${postVote === -1 ? 'text-[var(--sr-danger)]' : 'text-[var(--sr-text-muted)]'}`}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
            {!thread!.is_locked && (
              <button
                type="button"
                onClick={() => {
                  setReplyTo(replyTo === post.id ? null : post.id);
                  setReplyPostId(post.id);
                  setReplyBody('');
                }}
                className="text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]"
              >
                Reply
              </button>
            )}
            {canAccept && !accepted && !thread!.is_locked && (
              <button
                type="button"
                onClick={async () => {
                  const acceptError = await acceptAnswer(thread!.id, post.id);
                  if (acceptError) setError(acceptError);
                  else await load();
                }}
                className="text-[var(--sr-text-muted)] hover:text-[var(--sr-primary)]"
              >
                Accept answer
              </button>
            )}
            {accepted && canAccept && (
              <button
                type="button"
                onClick={async () => {
                  const acceptError = await acceptAnswer(thread!.id, null);
                  if (acceptError) setError(acceptError);
                  else await load();
                }}
                className="text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]"
              >
                Unaccept
              </button>
            )}
            {canEditPost && (
              <button
                type="button"
                onClick={() => {
                  setEditingPostId(post.id);
                  setEditingPostBody(post.body);
                }}
                className="text-[var(--sr-text-muted)] hover:text-[var(--sr-text)]"
              >
                Edit
              </button>
            )}
            {(canEditPost || staff) && (
              <button
                type="button"
                onClick={async () => {
                  const deleteError = await deletePost(post.id);
                  if (deleteError) setError(deleteError);
                  else await load();
                }}
                className="text-[var(--sr-text-muted)] hover:text-[var(--sr-danger)]"
              >
                Delete
              </button>
            )}
            {profile && (
              <button
                type="button"
                onClick={() => {
                  setReportOpen(reportOpen === `p:${post.id}` ? null : `p:${post.id}`);
                  setReportReason('');
                }}
                className="text-[var(--sr-text-muted)] hover:text-[var(--sr-warn)]"
              >
                <Flag className="mr-1 inline h-3 w-3" />
                Report
              </button>
            )}
          </div>

          {reportOpen === `p:${post.id}` && (
            <ReportBox
              value={reportReason}
              onChange={setReportReason}
              onSubmit={() => void handleReport({ postId: post.id })}
              onCancel={() => setReportOpen(null)}
            />
          )}

          {replyTo === post.id && thread!.is_locked === false && (
            <form onSubmit={submitReply} className="mt-3">
              <label htmlFor={`reply-${post.id}`} className="sr-only">
                Reply to {post.author?.username ?? 'this post'}
              </label>
              <textarea
                id={`reply-${post.id}`}
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                rows={3}
                className="sr-input resize-y"
                placeholder="Write a reply…"
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button type="submit" disabled={replySubmitting} className="sr-btn-primary">
                  {replySubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Post reply
                </button>
                <button
                  type="button"
                  className="sr-btn-ghost"
                  onClick={() => {
                    setReplyTo(null);
                    setReplyPostId(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {post.replies && post.replies.length > 0 && (
          <ul className="mt-1">{post.replies.map((reply) => renderPost(reply, depth + 1))}</ul>
        )}
      </li>
    );
  }

  return (
    <article aria-label={thread.title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => void onBack()} className="sr-btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          All discussions
        </button>
        <div className="flex flex-wrap gap-2">
          {(mine || staff) && (
            <button
              type="button"
              onClick={() => setEditingThread((current) => !current)}
              className="sr-btn-ghost"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          )}
          {staff && (
            <>
              <button
                type="button"
                onClick={async () => {
                  const flagError = await setThreadFlags(thread.id, {
                    is_pinned: !thread.is_pinned,
                  });
                  if (flagError) setError(flagError);
                  else {
                    setThread((current) =>
                      current ? { ...current, is_pinned: !current.is_pinned } : current,
                    );
                    onThreadChanged();
                  }
                }}
                className="sr-btn-ghost"
              >
                <Pin className="h-4 w-4" />
                {thread.is_pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const flagError = await setThreadFlags(thread.id, {
                    is_locked: !thread.is_locked,
                  });
                  if (flagError) setError(flagError);
                  else {
                    setThread((current) =>
                      current ? { ...current, is_locked: !current.is_locked } : current,
                    );
                    onThreadChanged();
                  }
                }}
                className="sr-btn-ghost"
              >
                {thread.is_locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {thread.is_locked ? 'Unlock' : 'Lock'}
              </button>
            </>
          )}
          {(mine || staff) && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="sr-btn-ghost text-[var(--sr-danger)]"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      <header className="border-b border-[var(--sr-border)] pb-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="sr-badge bg-[var(--sr-surface-2)] text-[var(--sr-text-dim)]">
            {forumCategoryLabel(thread.category)}
          </span>
          {thread.is_pinned && (
            <span className="sr-badge bg-[var(--sr-primary)]/10 text-[var(--sr-primary)]">
              <Pin aria-hidden="true" className="h-3 w-3" />
              Pinned
            </span>
          )}
          {thread.is_locked && (
            <span className="sr-badge bg-[var(--sr-surface-2)] text-[var(--sr-text-dim)]">
              <Lock aria-hidden="true" className="h-3 w-3" />
              Locked
            </span>
          )}
          {thread.is_solved && (
            <span className="sr-badge bg-[var(--sr-ok-bg)] text-[var(--sr-primary)]">
              <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
              Solved
            </span>
          )}
        </div>

        {editingThread ? (
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="text"
              value={threadTitle}
              onChange={(event) => setThreadTitle(event.target.value)}
              className="sr-input"
              aria-label="Discussion title"
            />
            <select
              value={threadCategory}
              onChange={(event) => setThreadCategory(event.target.value as ForumCategory)}
              className="sr-input"
              aria-label="Discussion category"
            >
              {FORUM_CATEGORIES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            <textarea
              value={threadBody}
              onChange={(event) => setThreadBody(event.target.value)}
              rows={5}
              className="sr-input resize-y"
              aria-label="Discussion message"
            />
            <div className="flex gap-2">
              <button type="button" className="sr-btn-primary" onClick={() => void saveThreadEdits()}>
                Save changes
              </button>
              <button type="button" className="sr-btn-ghost" onClick={() => setEditingThread(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mt-2 text-2xl font-bold">{thread.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--sr-text-muted)]">
              <Avatar
                name={thread.author?.username ?? 'Member'}
                src={thread.author?.avatar_url ?? null}
                className="h-7 w-7 text-xs"
              />
              <span className="font-semibold text-[var(--sr-text)]">
                {thread.author?.username ?? 'Member'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{timeAgo(thread.created_at)}</span>
            </div>
            <div className="mt-3">
              <FormattedText text={thread.body} />
            </div>
          </>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <div className="inline-flex items-center border border-[var(--sr-border)]">
            <button
              type="button"
              onClick={() => void handleThreadVote(1)}
              aria-pressed={threadVote === 1}
              aria-label="Upvote discussion"
              className={`p-1.5 hover:text-[var(--sr-primary)] ${threadVote === 1 ? 'text-[var(--sr-primary)]' : 'text-[var(--sr-text-muted)]'}`}
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <span className="sr-mono min-w-7 text-center text-sm text-[var(--sr-text)]">
              {thread.score}
            </span>
            <button
              type="button"
              onClick={() => void handleThreadVote(-1)}
              aria-pressed={threadVote === -1}
              aria-label="Downvote discussion"
              className={`p-1.5 hover:text-[var(--sr-danger)] ${threadVote === -1 ? 'text-[var(--sr-danger)]' : 'text-[var(--sr-text-muted)]'}`}
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
          <span className="text-[var(--sr-text-muted)]">
            {posts.length} {posts.length === 1 ? 'reply' : 'replies'}
          </span>
          {profile && (
            <button
              type="button"
              onClick={() => {
                setReportOpen(reportOpen === 'thread' ? null : 'thread');
                setReportReason('');
              }}
              className="ml-auto inline-flex items-center gap-1 text-[var(--sr-text-muted)] hover:text-[var(--sr-warn)]"
            >
              <Flag className="h-3 w-3" />
              Report
            </button>
          )}
        </div>

        {reportOpen === 'thread' && (
          <ReportBox
            value={reportReason}
            onChange={setReportReason}
            onSubmit={() => void handleReport({ threadId: thread.id })}
            onCancel={() => setReportOpen(null)}
          />
        )}

        {reportNotice && (
          <p role="status" className="mt-2 border-l-2 border-[var(--sr-primary)] px-3 py-1.5 text-xs text-[var(--sr-text-muted)]">
            {reportNotice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 rounded-sm border border-[var(--sr-danger)]/40 bg-[var(--sr-bad-bg)] px-3 py-2 text-sm text-[var(--sr-danger)]">
            {error}
          </p>
        )}
      </header>

      {posts.length === 0 ? (
        <p className="mt-4 border-l-2 border-[var(--sr-border-hover)] px-3 py-2 text-sm text-[var(--sr-text-muted)]">
          No replies yet. {thread.is_locked ? 'This discussion is locked.' : 'Be the first to answer.'}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[var(--sr-border)]">
          {tree.map((post) => renderPost(post, 0))}
        </ul>
      )}

      <section className="mt-5 border-t border-[var(--sr-border)] pt-4" aria-label="Reply to discussion">
        <h3 className="text-sm font-bold">Join the discussion</h3>
        {thread.is_locked ? (
          <p className="mt-2 border-l-2 border-[var(--sr-warn)] px-3 py-2 text-sm text-[var(--sr-text-muted)]">
            This discussion is locked. New replies are closed.
          </p>
        ) : !profile ? (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-[var(--sr-text-muted)]">Sign in to reply to this discussion.</p>
            <button type="button" className="sr-btn-primary" onClick={openAuth}>
              Sign in
            </button>
          </div>
        ) : (
          <form onSubmit={submitReply} className="mt-2">
            <label htmlFor="thread-reply" className="sr-only">
              Reply to this discussion
            </label>
            <textarea
              id="thread-reply"
              value={replyTo === null ? replyBody : ''}
              onChange={(event) => {
                setReplyTo(null);
                setReplyPostId(null);
                setReplyBody(event.target.value);
              }}
              rows={4}
              className="sr-input resize-y"
              placeholder="Share your answer or strategy…"
            />
            <div className="mt-2 flex justify-end">
              <button type="submit" disabled={replySubmitting || !replyBody.trim()} className="sr-btn-primary">
                {replySubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Post reply
              </button>
            </div>
          </form>
        )}
      </section>

      <ConfirmationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this discussion?"
        description="The discussion and every reply will be removed. This cannot be undone."
        confirmLabel="Delete discussion"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          void (async () => {
            const deleteError = await deleteThread(thread.id);
            if (deleteError) {
              setError(deleteError);
              return;
            }
            await onBack();
          })();
        }}
      />
    </article>
  );
}

function ReportBox({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-2 border border-[var(--sr-border)] bg-[var(--sr-surface-2)]/40 p-2">
      <label htmlFor="report-reason" className="mb-1 block text-xs font-medium text-[var(--sr-text-dim)]">
        Why are you reporting this?
      </label>
      <textarea
        id="report-reason"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={2}
        className="sr-input resize-y"
        placeholder="Spam, abuse, or off-topic content…"
      />
      <div className="mt-1.5 flex gap-2">
        <button type="button" className="sr-btn-primary" onClick={onSubmit} disabled={!value.trim()}>
          Send report
        </button>
        <button type="button" className="sr-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
