CREATE OR REPLACE FUNCTION public.capture_run_review_as_reference()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('verified', 'rejected')
     AND NEW.verified_by IS NOT NULL
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.reference_examples (run_id, game_id, category_id, label, notes, marked_by)
    VALUES (
      NEW.id,
      NEW.game_id,
      NEW.category_id,
      NEW.status,
      CASE WHEN NEW.status = 'rejected' THEN NULLIF(btrim(NEW.rejection_reason), '') ELSE NULL END,
      NEW.verified_by
    )
    ON CONFLICT (run_id) DO UPDATE SET
      game_id = EXCLUDED.game_id,
      category_id = EXCLUDED.category_id,
      label = EXCLUDED.label,
      notes = EXCLUDED.notes,
      marked_by = EXCLUDED.marked_by;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.capture_run_review_as_reference() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER capture_run_review_as_reference
AFTER UPDATE OF status ON public.runs
FOR EACH ROW
EXECUTE FUNCTION public.capture_run_review_as_reference();

INSERT INTO public.reference_examples (run_id, game_id, category_id, label, notes, marked_by)
SELECT
  id,
  game_id,
  category_id,
  status,
  CASE WHEN status = 'rejected' THEN NULLIF(btrim(rejection_reason), '') ELSE NULL END,
  verified_by
FROM public.runs
WHERE status IN ('verified', 'rejected')
  AND verified_by IS NOT NULL
ON CONFLICT (run_id) DO UPDATE SET
  game_id = EXCLUDED.game_id,
  category_id = EXCLUDED.category_id,
  label = EXCLUDED.label,
  notes = EXCLUDED.notes,
  marked_by = EXCLUDED.marked_by;
