-- SplitRush SQL editor paste 8 of 11
-- 8 of 11 - vote score triggers
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires 07_forum_tables.sql. Contains function blocks.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

CREATE OR REPLACE FUNCTION public.sync_forum_thread_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sr$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads SET score = score + NEW.value WHERE id = NEW.thread_id;
    RETURN NEW;
  END IF;
  UPDATE public.forum_threads SET score = score - OLD.value WHERE id = OLD.thread_id;
  RETURN OLD;
END $sr$;
REVOKE EXECUTE ON FUNCTION public.sync_forum_thread_score() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_forum_post_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sr$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts SET score = score + NEW.value WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  UPDATE public.forum_posts SET score = score - OLD.value WHERE id = OLD.post_id;
  RETURN OLD;
END $sr$;
REVOKE EXECUTE ON FUNCTION public.sync_forum_post_score() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS forum_thread_votes_insert ON public.forum_votes;
CREATE TRIGGER forum_thread_votes_insert
  AFTER INSERT ON public.forum_votes
  FOR EACH ROW WHEN (NEW.thread_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_forum_thread_score();

DROP TRIGGER IF EXISTS forum_thread_votes_delete ON public.forum_votes;
CREATE TRIGGER forum_thread_votes_delete
  AFTER DELETE ON public.forum_votes
  FOR EACH ROW WHEN (OLD.thread_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_forum_thread_score();

DROP TRIGGER IF EXISTS forum_post_votes_insert ON public.forum_votes;
CREATE TRIGGER forum_post_votes_insert
  AFTER INSERT ON public.forum_votes
  FOR EACH ROW WHEN (NEW.post_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_forum_post_score();

DROP TRIGGER IF EXISTS forum_post_votes_delete ON public.forum_votes;
CREATE TRIGGER forum_post_votes_delete
  AFTER DELETE ON public.forum_votes
  FOR EACH ROW WHEN (OLD.post_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_forum_post_score();

-- END OF FILE: 08_forum_score_triggers.sql
