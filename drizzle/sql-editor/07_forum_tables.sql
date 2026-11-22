-- SplitRush SQL editor paste 7 of 11
-- 7 of 11 - forum tables, grants, and RLS
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires the base SplitRush schema.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

/* ------------------------------------------------------------------ *
 * Game forums
 * ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'help', 'strategies', 'questions', 'tips')),
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  is_solved boolean NOT NULL DEFAULT false,
  accepted_post_id uuid,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_threads_game_idx
  ON public.forum_threads (game_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_threads_author_idx ON public.forum_threads (author_id);

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  parent_post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (btrim(body) <> ''),
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_posts_thread_idx
  ON public.forum_posts (thread_id, created_at);
CREATE INDEX IF NOT EXISTS forum_posts_parent_idx ON public.forum_posts (parent_post_id);

ALTER TABLE public.forum_threads
  DROP CONSTRAINT IF EXISTS forum_threads_accepted_post_fkey;
ALTER TABLE public.forum_threads
  ADD CONSTRAINT forum_threads_accepted_post_fkey
  FOREIGN KEY (accepted_post_id) REFERENCES public.forum_posts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.forum_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_votes_one_target CHECK (
    (thread_id IS NOT NULL AND post_id IS NULL)
    OR (thread_id IS NULL AND post_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_votes_user_thread_key
  ON public.forum_votes (user_id, thread_id) WHERE thread_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS forum_votes_user_post_key
  ON public.forum_votes (user_id, post_id) WHERE post_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_reports_one_target CHECK (
    (thread_id IS NOT NULL AND post_id IS NULL)
    OR (thread_id IS NULL AND post_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS forum_reports_status_idx ON public.forum_reports (status, created_at DESC);

GRANT SELECT ON public.forum_threads, public.forum_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.forum_threads, public.forum_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_votes TO authenticated;
GRANT SELECT, INSERT ON public.forum_reports TO authenticated;
GRANT UPDATE ON public.forum_reports TO authenticated;
GRANT ALL ON public.forum_threads, public.forum_posts, public.forum_votes, public.forum_reports
  TO service_role;

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

-- END OF FILE: 07_forum_tables.sql
