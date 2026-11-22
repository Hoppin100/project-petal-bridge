-- SplitRush SQL editor paste 7 of 7
-- Adds vote_forum_thread and vote_forum_post. Run this after 06 because they use the forum_votes table.
--
-- Paste this ENTIRE file into the Supabase SQL editor and run it once.
-- Safe to re-run: statements use IF NOT EXISTS / DROP ... IF EXISTS.
-- Requires the base SplitRush schema and the earlier numbered files
-- in this folder (see README.md for the order).

/* ------------------------------------------------------------------ *
 * Vote helpers: one row per member and target, safe to call repeatedly.
 * ------------------------------------------------------------------ */

CREATE OR REPLACE FUNCTION public.vote_forum_thread(p_thread uuid, p_value smallint)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  DELETE FROM public.forum_votes WHERE user_id = auth.uid() AND thread_id = p_thread;
  IF p_value NOT IN (-1, 1) THEN RETURN; END IF;
  INSERT INTO public.forum_votes (user_id, thread_id, value)
  VALUES (auth.uid(), p_thread, p_value);
END $$;
REVOKE EXECUTE ON FUNCTION public.vote_forum_thread(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_forum_thread(uuid, smallint) TO authenticated;

CREATE OR REPLACE FUNCTION public.vote_forum_post(p_post uuid, p_value smallint)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  DELETE FROM public.forum_votes WHERE user_id = auth.uid() AND post_id = p_post;
  IF p_value NOT IN (-1, 1) THEN RETURN; END IF;
  INSERT INTO public.forum_votes (user_id, post_id, value)
  VALUES (auth.uid(), p_post, p_value);
END $$;
REVOKE EXECUTE ON FUNCTION public.vote_forum_post(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_forum_post(uuid, smallint) TO authenticated;
