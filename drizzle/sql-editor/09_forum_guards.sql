-- SplitRush SQL editor paste 9 of 11
-- 9 of 11 - lock, pin, reply, and accepted-answer guards
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires 07_forum_tables.sql. Contains function blocks.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

CREATE OR REPLACE FUNCTION public.guard_forum_thread_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $sr$
BEGIN
  IF NOT public.is_game_staff() THEN
    IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
       OR NEW.is_locked IS DISTINCT FROM OLD.is_locked THEN
      RAISE EXCEPTION 'Only staff can pin or lock discussions';
    END IF;
    IF NEW.accepted_post_id IS DISTINCT FROM OLD.accepted_post_id
       AND auth.uid() <> OLD.author_id
       AND NOT public.is_game_staff() THEN
      RAISE EXCEPTION 'Only the author or staff can accept an answer';
    END IF;
  END IF;

  IF NEW.accepted_post_id IS DISTINCT FROM OLD.accepted_post_id THEN
    IF NEW.accepted_post_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.forum_posts p
         WHERE p.id = NEW.accepted_post_id AND p.thread_id = NEW.id
       ) THEN
      RAISE EXCEPTION 'Accepted answer must belong to this discussion';
    END IF;
    NEW.is_solved := NEW.accepted_post_id IS NOT NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $sr$;
REVOKE EXECUTE ON FUNCTION public.guard_forum_thread_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS forum_threads_guard_update ON public.forum_threads;
CREATE TRIGGER forum_threads_guard_update
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_thread_update();

CREATE OR REPLACE FUNCTION public.guard_forum_post_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $sr$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.forum_threads t
    WHERE t.id = NEW.thread_id AND t.is_locked
  ) AND NOT public.is_game_staff() THEN
    RAISE EXCEPTION 'This discussion is locked';
  END IF;
  IF NEW.parent_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.forum_posts p
    WHERE p.id = NEW.parent_post_id AND p.thread_id = NEW.thread_id
  ) THEN
    RAISE EXCEPTION 'Replies must stay inside the same discussion';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $sr$;
REVOKE EXECUTE ON FUNCTION public.guard_forum_post_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS forum_posts_guard_insert ON public.forum_posts;
CREATE TRIGGER forum_posts_guard_insert
  BEFORE INSERT ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_post_insert();

-- END OF FILE: 09_forum_guards.sql
