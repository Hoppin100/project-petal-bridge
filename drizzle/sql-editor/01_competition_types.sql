-- SplitRush SQL editor paste 1 of 11
-- 1 of 11 - competition columns, record submissions, and visibility rules
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires the base SplitRush schema. Run first.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

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

-- END OF FILE: 01_competition_types.sql
