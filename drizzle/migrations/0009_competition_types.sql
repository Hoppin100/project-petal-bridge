-- Competition types: Speedruns and Records
--
-- A game keeps a single `games` row. Each competition is a `categories` row, so
-- one game can hold any number of speedrun competitions AND any number of
-- record competitions at the same time.
--
--   categories.competition_type = 'speedrun'  -> timed leaderboard (public.runs)
--   categories.competition_type = 'record'    -> numeric leaderboard (public.record_submissions)
--
-- Existing rows are speedruns, so the default keeps all current data exactly
-- where it is. Nothing is dropped or rewritten.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS competition_type text NOT NULL DEFAULT 'speedrun',
  ADD COLUMN IF NOT EXISTS record_unit text,
  ADD COLUMN IF NOT EXISTS record_description text,
  ADD COLUMN IF NOT EXISTS record_rules text,
  ADD COLUMN IF NOT EXISTS record_higher_is_better boolean NOT NULL DEFAULT true;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_competition_type_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_competition_type_check
  CHECK (competition_type IN ('speedrun', 'record'));

-- A record competition must state the measurement unit shown next to values.
ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_record_unit_check;
ALTER TABLE public.categories
  ADD CONSTRAINT categories_record_unit_check
  CHECK (
    competition_type <> 'record'
    OR (record_unit IS NOT NULL AND btrim(record_unit) <> '')
  );

CREATE INDEX IF NOT EXISTS categories_game_type_idx
  ON public.categories (game_id, competition_type, sort_order, name);

-- Record submissions live beside speedrun runs rather than inside them, so
-- existing run data and tooling are untouched.
CREATE TABLE IF NOT EXISTS public.record_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  submitter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  value_numeric numeric(16, 3) NOT NULL CHECK (value_numeric > 0),
  platform text NOT NULL DEFAULT 'Unknown',
  video_url text NOT NULL,
  video_id text,
  video_start_seconds integer CHECK (video_start_seconds IS NULL OR video_start_seconds >= 0),
  video_end_seconds integer CHECK (video_end_seconds IS NULL OR video_end_seconds >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  rejection_reason text,
  moderator_notes text,
  notes text,
  verified_by uuid REFERENCES public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS record_submissions_category_idx
  ON public.record_submissions (game_id, category_id, value_numeric);
CREATE INDEX IF NOT EXISTS record_submissions_submitter_idx
  ON public.record_submissions (submitter_id);
CREATE INDEX IF NOT EXISTS record_submissions_status_idx
  ON public.record_submissions (status);

GRANT SELECT ON public.record_submissions TO anon, authenticated;
GRANT INSERT (
  game_id, category_id, value_numeric, platform, video_url, video_id,
  video_start_seconds, video_end_seconds, notes
) ON public.record_submissions TO authenticated;
GRANT UPDATE (notes) ON public.record_submissions TO authenticated;
GRANT ALL ON public.record_submissions TO service_role;

ALTER TABLE public.record_submissions ENABLE ROW LEVEL SECURITY;

-- Submitters see their own rows, staff see everything, and the public sees
-- verified values on visible games only.
DROP POLICY IF EXISTS record_submissions_select_visible ON public.record_submissions;
CREATE POLICY record_submissions_select_visible ON public.record_submissions
  FOR SELECT TO anon, authenticated
  USING (
    submitter_id = auth.uid()
    OR public.is_game_staff()
    OR (
      status = 'verified'
      AND EXISTS (
        SELECT 1 FROM public.games g
        WHERE g.id = game_id AND NOT g.is_hidden
      )
    )
  );

DROP POLICY IF EXISTS record_submissions_insert_own ON public.record_submissions;
CREATE POLICY record_submissions_insert_own ON public.record_submissions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = submitter_id);

DROP POLICY IF EXISTS record_submissions_update_own ON public.record_submissions;
CREATE POLICY record_submissions_update_own ON public.record_submissions
  FOR UPDATE TO authenticated
  USING (auth.uid() = submitter_id)
  WITH CHECK (auth.uid() = submitter_id);

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

-- Moderation functions mirror verify_run / reject_run / delete_run.

CREATE OR REPLACE FUNCTION public.verify_record_submission(
  p_submission uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.record_submissions
  SET status = 'verified',
      verified_by = auth.uid(),
      verified_at = now(),
      rejection_reason = NULL,
      moderator_notes = COALESCE(NULLIF(btrim(p_notes), ''), moderator_notes)
  WHERE id = p_submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record submission not found'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.verify_record_submission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_record_submission(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_record_submission(
  p_submission uuid,
  p_reason text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;
  UPDATE public.record_submissions
  SET status = 'rejected',
      verified_by = auth.uid(),
      verified_at = now(),
      rejection_reason = btrim(p_reason),
      moderator_notes = COALESCE(NULLIF(btrim(p_notes), ''), moderator_notes)
  WHERE id = p_submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record submission not found'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.reject_record_submission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_record_submission(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_record_submission(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Only owners can delete record submissions'; END IF;
  DELETE FROM public.record_submissions WHERE id = p_submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record submission not found'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_record_submission(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_record_submission(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_record_moderator_notes(
  p_submission uuid,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.record_submissions
  SET moderator_notes = NULLIF(btrim(p_notes), '')
  WHERE id = p_submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record submission not found'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_record_moderator_notes(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_record_moderator_notes(uuid, text) TO authenticated;
