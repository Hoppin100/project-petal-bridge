-- SplitRush SQL editor paste 10 of 11
-- 10 of 11 - forum read/write and report policies
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires 07_forum_tables.sql.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

DROP POLICY IF EXISTS forum_threads_select_visible ON public.forum_threads;
CREATE POLICY forum_threads_select_visible ON public.forum_threads
  FOR SELECT TO anon, authenticated
  USING (
    public.is_game_staff()
    OR EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND NOT g.is_hidden
    )
  );

DROP POLICY IF EXISTS forum_threads_insert_own ON public.forum_threads;
CREATE POLICY forum_threads_insert_own ON public.forum_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      public.is_game_staff()
      OR EXISTS (
        SELECT 1 FROM public.games g
        WHERE g.id = game_id AND NOT g.is_hidden
      )
    )
  );

DROP POLICY IF EXISTS forum_threads_update_own ON public.forum_threads;
CREATE POLICY forum_threads_update_own ON public.forum_threads
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff())
  WITH CHECK (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_threads_delete_own ON public.forum_threads;
CREATE POLICY forum_threads_delete_own ON public.forum_threads
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_posts_select_visible ON public.forum_posts;
CREATE POLICY forum_posts_select_visible ON public.forum_posts
  FOR SELECT TO anon, authenticated
  USING (
    public.is_game_staff()
    OR EXISTS (
      SELECT 1
      FROM public.forum_threads t
      JOIN public.games g ON g.id = t.game_id
      WHERE t.id = thread_id AND NOT g.is_hidden
    )
  );

DROP POLICY IF EXISTS forum_posts_insert_own ON public.forum_posts;
CREATE POLICY forum_posts_insert_own ON public.forum_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      public.is_game_staff()
      OR EXISTS (
        SELECT 1
        FROM public.forum_threads t
        JOIN public.games g ON g.id = t.game_id
        WHERE t.id = thread_id AND NOT g.is_hidden
      )
    )
  );

DROP POLICY IF EXISTS forum_posts_update_own ON public.forum_posts;
CREATE POLICY forum_posts_update_own ON public.forum_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff())
  WITH CHECK (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_posts_delete_own ON public.forum_posts;
CREATE POLICY forum_posts_delete_own ON public.forum_posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_votes_select_own ON public.forum_votes;
CREATE POLICY forum_votes_select_own ON public.forum_votes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS forum_votes_insert_own ON public.forum_votes;
CREATE POLICY forum_votes_insert_own ON public.forum_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS forum_votes_delete_own ON public.forum_votes;
CREATE POLICY forum_votes_delete_own ON public.forum_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS forum_reports_select_own ON public.forum_reports;
CREATE POLICY forum_reports_select_own ON public.forum_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_reports_insert_own ON public.forum_reports;
CREATE POLICY forum_reports_insert_own ON public.forum_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS forum_reports_update_staff ON public.forum_reports;
CREATE POLICY forum_reports_update_staff ON public.forum_reports
  FOR UPDATE TO authenticated
  USING (public.is_game_staff())
  WITH CHECK (public.is_game_staff());

-- END OF FILE: 10_forum_policies.sql
