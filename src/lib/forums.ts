import { supabase } from '@/lib/supabase';
import type { ForumCategory, ForumPost, ForumReport, ForumThread, Profile } from '@/lib/types';

export const FORUM_THREAD_COLUMNS =
  'id, game_id, author_id, title, body, category, is_pinned, is_locked, is_solved, accepted_post_id, score, created_at, updated_at';

export const FORUM_POST_COLUMNS =
  'id, thread_id, parent_post_id, author_id, body, score, created_at, updated_at';

export const FORUM_CATEGORIES: Array<{ id: ForumCategory; label: string }> = [
  { id: 'general', label: 'General Discussion' },
  { id: 'help', label: 'Game Help' },
  { id: 'strategies', label: 'Strategies' },
  { id: 'questions', label: 'Questions' },
  { id: 'tips', label: 'Tips and Tricks' },
];

export function forumCategoryLabel(category: ForumCategory): string {
  return FORUM_CATEGORIES.find((entry) => entry.id === category)?.label ?? 'Discussion';
}

export type ForumSort = 'newest' | 'top' | 'active';

/** Pinned threads always stay on top; the chosen sort orders the rest. */
export function sortThreads(threads: ForumThread[], sort: ForumSort): ForumThread[] {
  const copy = [...threads];
  copy.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    if (sort === 'top') return b.score - a.score || b.reply_count! - a.reply_count!;
    if (sort === 'active') {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return copy;
}

export function filterThreads(
  threads: ForumThread[],
  options: { search?: string; category?: ForumCategory | 'all' } = {},
): ForumThread[] {
  const term = (options.search ?? '').trim().toLowerCase();
  return threads.filter((thread) => {
    if (options.category && options.category !== 'all' && thread.category !== options.category) {
      return false;
    }
    if (!term) return true;
    return (
      thread.title.toLowerCase().includes(term) ||
      thread.body.toLowerCase().includes(term)
    );
  });
}

/** Nested replies for rendering; orphans fall back to the root level. */
export function buildPostTree(posts: ForumPost[]): ForumPost[] {
  const byId = new Map<string, ForumPost>();
  for (const post of posts) byId.set(post.id, { ...post, replies: [] });
  const roots: ForumPost[] = [];
  for (const post of posts) {
    const node = byId.get(post.id)!;
    const parent = post.parent_post_id ? byId.get(post.parent_post_id) : undefined;
    if (parent) parent.replies!.push(node);
    else roots.push(node);
  }
  const sortRecursive = (list: ForumPost[]) => {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    list.forEach((item) => sortRecursive(item.replies ?? []));
  };
  sortRecursive(roots);
  return roots;
}

function missingTable(error: { code?: string; message: string } | null): boolean {
  return Boolean(
    error &&
      (error.code === '42P01' ||
        error.code === 'PGRST205' ||
        /forum_|schema cache/i.test(error.message)),
  );
}

async function attachAuthors<T extends { author_id: string }>(rows: T[]): Promise<T[]> {
  const ids = [...new Set(rows.map((row) => row.author_id))];
  if (ids.length === 0) return rows;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, role, bio, avatar_url, created_at')
    .in('id', ids);
  const byId = new Map(((data as Profile[]) ?? []).map((profile) => [profile.id, profile]));
  return rows.map((row) => ({ ...row, author: byId.get(row.author_id) }));
}

/** Threads for one game with author and reply count. */
export async function fetchGameThreads(gameId: string): Promise<{
  threads: ForumThread[];
  error: string | null;
  migrationMissing: boolean;
}> {
  const { data, error } = await supabase
    .from('forum_threads')
    .select(FORUM_THREAD_COLUMNS)
    .eq('game_id', gameId)
    .order('created_at', { ascending: false });

  if (error) {
    const missing = missingTable(error);
    return { threads: [], error: missing ? null : error.message, migrationMissing: missing };
  }

  const threads = (data as ForumThread[]) ?? [];
  if (threads.length === 0) return { threads, error: null, migrationMissing: false };

  const { data: postRows } = await supabase
    .from('forum_posts')
    .select('thread_id')
    .in('thread_id', threads.map((thread) => thread.id));
  const counts = new Map<string, number>();
  for (const row of (postRows as Array<{ thread_id: string }>) ?? []) {
    counts.set(row.thread_id, (counts.get(row.thread_id) ?? 0) + 1);
  }

  const withAuthors = await attachAuthors(threads);
  return {
    threads: withAuthors.map((thread) => ({
      ...thread,
      reply_count: counts.get(thread.id) ?? 0,
    })),
    error: null,
    migrationMissing: false,
  };
}

export async function fetchThread(threadId: string): Promise<{
  thread: ForumThread | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('forum_threads')
    .select(FORUM_THREAD_COLUMNS)
    .eq('id', threadId)
    .maybeSingle();
  if (error) return { thread: null, error: error.message };
  if (!data) return { thread: null, error: null };
  const [withAuthor] = await attachAuthors([data as ForumThread]);
  return { thread: withAuthor ?? null, error: null };
}

export async function fetchThreadPosts(threadId: string): Promise<{
  posts: ForumPost[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('forum_posts')
    .select(FORUM_POST_COLUMNS)
    .eq('thread_id', threadId)
    .order('created_at');
  if (error) return { posts: [], error: error.message };
  const posts = (data as ForumPost[]) ?? [];
  return { posts: await attachAuthors(posts), error: null };
}

export async function createThread(input: {
  gameId: string;
  authorId: string;
  title: string;
  body: string;
  category: ForumCategory;
}): Promise<{ threadId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('forum_threads')
    .insert({
      game_id: input.gameId,
      author_id: input.authorId,
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category,
    })
    .select('id')
    .single();
  if (error) return { threadId: null, error: error.message };
  return { threadId: (data as { id: string }).id, error: null };
}

export async function createReply(input: {
  threadId: string;
  authorId: string;
  body: string;
  parentPostId?: string | null;
}): Promise<{ postId: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('forum_posts')
    .insert({
      thread_id: input.threadId,
      parent_post_id: input.parentPostId ?? null,
      author_id: input.authorId,
      body: input.body.trim(),
    })
    .select('id')
    .single();
  if (error) return { postId: null, error: error.message };
  return { postId: (data as { id: string }).id, error: null };
}

export async function voteThread(threadId: string, value: -1 | 0 | 1): Promise<string | null> {
  const { error } = await supabase.rpc('vote_forum_thread', {
    p_thread: threadId,
    p_value: value,
  });
  return error ? error.message : null;
}

export async function votePost(postId: string, value: -1 | 0 | 1): Promise<string | null> {
  const { error } = await supabase.rpc('vote_forum_post', {
    p_post: postId,
    p_value: value,
  });
  return error ? error.message : null;
}

export async function reportContent(input: {
  reporterId: string;
  reason: string;
  threadId?: string | null;
  postId?: string | null;
}): Promise<string | null> {
  const { error } = await supabase.from('forum_reports').insert({
    reporter_id: input.reporterId,
    thread_id: input.threadId ?? null,
    post_id: input.postId ?? null,
    reason: input.reason.trim(),
  });
  return error ? error.message : null;
}

export async function setThreadFlags(
  threadId: string,
  flags: { is_pinned?: boolean; is_locked?: boolean },
): Promise<string | null> {
  const { error } = await supabase.from('forum_threads').update(flags).eq('id', threadId);
  return error ? error.message : null;
}

export async function updateThread(
  threadId: string,
  input: { title: string; body: string; category: ForumCategory },
): Promise<string | null> {
  const { error } = await supabase
    .from('forum_threads')
    .update({
      title: input.title.trim(),
      body: input.body.trim(),
      category: input.category,
    })
    .eq('id', threadId);
  return error ? error.message : null;
}

export async function updatePost(postId: string, body: string): Promise<string | null> {
  const { error } = await supabase
    .from('forum_posts')
    .update({ body: body.trim() })
    .eq('id', postId);
  return error ? error.message : null;
}

export async function deletePost(postId: string): Promise<string | null> {
  const { error } = await supabase.from('forum_posts').delete().eq('id', postId);
  return error ? error.message : null;
}

export async function acceptAnswer(
  threadId: string,
  postId: string | null,
): Promise<string | null> {
  const { error } = await supabase
    .from('forum_threads')
    .update({ accepted_post_id: postId })
    .eq('id', threadId);
  return error ? error.message : null;
}

export async function deleteThread(threadId: string): Promise<string | null> {
  const { error } = await supabase.from('forum_threads').delete().eq('id', threadId);
  return error ? error.message : null;
}

export async function fetchMyForumVotes(userId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('forum_votes')
    .select('thread_id, post_id, value')
    .eq('user_id', userId);
  if (error) return new Map();
  const votes = new Map<string, number>();
  for (const row of (data as Array<{ thread_id: string | null; post_id: string | null; value: number }>) ?? []) {
    const key = row.thread_id ? `t:${row.thread_id}` : `p:${row.post_id}`;
    votes.set(key, row.value);
  }
  return votes;
}

/**
 * Open reports for one game, with enough context for staff to judge them.
 * The caller is expected to be game staff; RLS returns nothing otherwise.
 */
export async function fetchOpenReports(gameId: string): Promise<{
  reports: ForumReport[];
  error: string | null;
  migrationMissing: boolean;
}> {
  const { data, error } = await supabase
    .from('forum_reports')
    .select('id, reporter_id, thread_id, post_id, reason, status, reviewed_by, reviewed_at, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    const missing = missingTable(error);
    return { reports: [], error: missing ? null : error.message, migrationMissing: missing };
  }

  const rows = (data as ForumReport[]) ?? [];
  if (rows.length === 0) return { reports: [], error: null, migrationMissing: false };

  const postIds = rows
    .map((row) => row.post_id)
    .filter((id): id is string => Boolean(id));
  const postsById = new Map<string, { thread_id: string; body: string }>();
  if (postIds.length > 0) {
    const { data: postRows } = await supabase
      .from('forum_posts')
      .select('id, thread_id, body')
      .in('id', postIds);
    for (const post of (postRows as Array<{ id: string; thread_id: string; body: string }>) ?? []) {
      postsById.set(post.id, { thread_id: post.thread_id, body: post.body });
    }
  }

  const threadIds = new Set<string>();
  for (const row of rows) {
    if (row.thread_id) threadIds.add(row.thread_id);
    if (row.post_id) {
      const parent = postsById.get(row.post_id);
      if (parent) threadIds.add(parent.thread_id);
    }
  }

  const threadsById = new Map<string, { game_id: string; title: string }>();
  if (threadIds.size > 0) {
    const { data: threadRows } = await supabase
      .from('forum_threads')
      .select('id, game_id, title')
      .in('id', [...threadIds]);
    for (const thread of (threadRows as Array<{ id: string; game_id: string; title: string }>) ?? []) {
      threadsById.set(thread.id, { game_id: thread.game_id, title: thread.title });
    }
  }

  const reporterIds = [...new Set(rows.map((row) => row.reporter_id))];
  const reportersById = new Map<string, Profile>();
  if (reporterIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, role, bio, avatar_url, created_at')
      .in('id', reporterIds);
    for (const profile of (profileRows as Profile[]) ?? []) {
      reportersById.set(profile.id, profile);
    }
  }

  const reports: ForumReport[] = [];
  for (const row of rows) {
    const parentPost = row.post_id ? postsById.get(row.post_id) : undefined;
    const threadId = row.thread_id ?? parentPost?.thread_id ?? null;
    const thread = threadId ? threadsById.get(threadId) : undefined;
    if (!thread || thread.game_id !== gameId) continue;
    reports.push({
      ...row,
      reporter: reportersById.get(row.reporter_id),
      thread_title: thread.title,
      target_thread_id: threadId ?? undefined,
      post_excerpt: parentPost
        ? parentPost.body.length > 180
          ? `${parentPost.body.slice(0, 180)}…`
          : parentPost.body
        : undefined,
    });
  }

  return { reports, error: null, migrationMissing: false };
}

export async function resolveReport(
  reportId: string,
  status: 'reviewed' | 'dismissed',
  reviewerId: string,
): Promise<string | null> {
  const { error } = await supabase
    .from('forum_reports')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reportId);
  return error ? error.message : null;
}
