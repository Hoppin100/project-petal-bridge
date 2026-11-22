-- SplitRush SQL editor paste 2 of 7
-- Adds the database guards that keep runs on speedrun boards and record values on record boards, and blocks type changes once a board has submissions.
--
-- Paste this ENTIRE file into the Supabase SQL editor and run it once.
-- Safe to re-run: statements use IF NOT EXISTS / DROP ... IF EXISTS.
-- Requires the base SplitRush schema and the earlier numbered files
-- in this folder (see README.md for the order).

-- Type guards: a run can never land on a record board and a record value can
-- never land on a speedrun board.

CREATE OR REPLACE FUNCTION public.guard_run_competition_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = NEW.category_id
      AND c.competition_type = 'record'
  ) THEN
    RAISE EXCEPTION 'Run submissions must target a speedrun competition'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_run_competition_type() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS runs_require_speedrun_category ON public.runs;
CREATE TRIGGER runs_require_speedrun_category
  BEFORE INSERT OR UPDATE OF category_id ON public.runs
  FOR EACH ROW EXECUTE FUNCTION public.guard_run_competition_type();

CREATE OR REPLACE FUNCTION public.guard_record_submission_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = NEW.category_id
      AND c.game_id = NEW.game_id
      AND c.competition_type = 'record'
  ) THEN
    RAISE EXCEPTION 'Record submissions must target a record competition in the same game'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_record_submission_category() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS record_submissions_require_record_category ON public.record_submissions;
CREATE TRIGGER record_submissions_require_record_category
  BEFORE INSERT OR UPDATE OF category_id, game_id ON public.record_submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_record_submission_category();

-- Changing a competition's type is only allowed while its board is empty, so
-- existing times and values can never be orphaned or reinterpreted.
CREATE OR REPLACE FUNCTION public.guard_competition_type_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.competition_type IS DISTINCT FROM OLD.competition_type THEN
    IF NEW.competition_type = 'record'
       AND EXISTS (SELECT 1 FROM public.runs r WHERE r.category_id = NEW.id) THEN
      RAISE EXCEPTION 'Competition already has speedrun submissions'
        USING ERRCODE = '23514';
    END IF;
    IF NEW.competition_type = 'speedrun'
       AND EXISTS (SELECT 1 FROM public.record_submissions s WHERE s.category_id = NEW.id) THEN
      RAISE EXCEPTION 'Competition already has record submissions'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_competition_type_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS categories_guard_competition_type ON public.categories;
CREATE TRIGGER categories_guard_competition_type
  BEFORE UPDATE OF competition_type ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.guard_competition_type_change();
