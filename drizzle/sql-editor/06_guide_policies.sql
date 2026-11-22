-- SplitRush SQL editor paste 6 of 11
-- 6 of 11 - guide read/write policies
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires 05_guide_tables.sql.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

DROP POLICY IF EXISTS guides_select_visible ON public.guides;
CREATE POLICY guides_select_visible ON public.guides
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    OR author_id = auth.uid()
    OR public.is_game_staff()
  );

DROP POLICY IF EXISTS guides_insert_own ON public.guides;
CREATE POLICY guides_insert_own ON public.guides
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

DROP POLICY IF EXISTS guides_update_own ON public.guides;
CREATE POLICY guides_update_own ON public.guides
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff())
  WITH CHECK (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS guides_delete_own ON public.guides;
CREATE POLICY guides_delete_own ON public.guides
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS guide_sections_select_visible ON public.guide_sections;
CREATE POLICY guide_sections_select_visible ON public.guide_sections
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id
        AND (g.status = 'published' OR g.author_id = auth.uid() OR public.is_game_staff())
    )
  );

DROP POLICY IF EXISTS guide_sections_write_own ON public.guide_sections;
CREATE POLICY guide_sections_write_own ON public.guide_sections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id
        AND (g.author_id = auth.uid() OR public.is_game_staff())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id
        AND (g.author_id = auth.uid() OR public.is_game_staff())
    )
  );

DROP POLICY IF EXISTS guide_votes_select_own ON public.guide_votes;
CREATE POLICY guide_votes_select_own ON public.guide_votes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS guide_votes_insert_own ON public.guide_votes;
CREATE POLICY guide_votes_insert_own ON public.guide_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id AND g.status = 'published'
    )
  );

DROP POLICY IF EXISTS guide_votes_delete_own ON public.guide_votes;
CREATE POLICY guide_votes_delete_own ON public.guide_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- END OF FILE: 06_guide_policies.sql
