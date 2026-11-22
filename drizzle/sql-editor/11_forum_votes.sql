-- SplitRush SQL editor paste 11 of 11
-- 11 of 11 - vote helper functions
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires 07_forum_tables.sql. Contains function blocks.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

/* ------------------------------------------------------------------ *
 * Vote helpers: one row per member and target, safe to call repeatedly.
 * ------------------------------------------------------------------ */

CREATE OR REPLACE FUNCTION public.vote_forum_thread(p_thread uuid, p_value smallint)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $sr$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  DELETE FROM public.forum_votes WHERE user_id = auth.uid() AND thread_id = p_thread;
  IF p_value NOT IN (-1, 1) THEN RETURN; END IF;
  INSERT INTO public.forum_votes (user_id, thread_id, value)
  VALUES (auth.uid(), p_thread, p_value);
END $sr$;
REVOKE EXECUTE ON FUNCTION public.vote_forum_thread(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_forum_thread(uuid, smallint) TO authenticated;

CREATE OR REPLACE FUNCTION public.vote_forum_post(p_post uuid, p_value smallint)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $sr$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  DELETE FROM public.forum_votes WHERE user_id = auth.uid() AND post_id = p_post;
  IF p_value NOT IN (-1, 1) THEN RETURN; END IF;
  INSERT INTO public.forum_votes (user_id, post_id, value)
  VALUES (auth.uid(), p_post, p_value);
END $sr$;
REVOKE EXECUTE ON FUNCTION public.vote_forum_post(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_forum_post(uuid, smallint) TO authenticated;

-- END OF FILE: 11_forum_votes.sql
