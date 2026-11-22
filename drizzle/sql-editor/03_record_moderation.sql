-- SplitRush SQL editor paste 3 of 11
-- 3 of 11 - owner verification and moderation functions for records
--
-- HOW TO USE: copy this ENTIRE file and run it once in the SQL editor.
-- Do not highlight part of it. Safe to re-run.
-- Requires 01_competition_types.sql.
-- If the last line of your paste is not "END OF FILE", the copy was cut off.

-- Moderation functions mirror verify_run / reject_run / delete_run.

CREATE OR REPLACE FUNCTION public.verify_record_submission(
  p_submission uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sr$
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
END $sr$;
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
AS $sr$
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
END $sr$;
REVOKE EXECUTE ON FUNCTION public.reject_record_submission(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_record_submission(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_record_submission(p_submission uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $sr$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Only owners can delete record submissions'; END IF;
  DELETE FROM public.record_submissions WHERE id = p_submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record submission not found'; END IF;
END $sr$;
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
AS $sr$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.record_submissions
  SET moderator_notes = NULLIF(btrim(p_notes), '')
  WHERE id = p_submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record submission not found'; END IF;
END $sr$;
REVOKE EXECUTE ON FUNCTION public.set_record_moderator_notes(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_record_moderator_notes(uuid, text) TO authenticated;

-- END OF FILE: 03_record_moderation.sql
