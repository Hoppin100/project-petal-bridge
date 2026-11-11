ALTER FUNCTION public.get_daily_challenge() RENAME TO _get_daily_challenge;

REVOKE ALL ON FUNCTION public._get_daily_challenge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._get_daily_challenge() TO service_role;

CREATE OR REPLACE FUNCTION public.get_daily_challenge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the owner can view the daily challenge.'
      USING ERRCODE = '42501';
  END IF;

  RETURN public._get_daily_challenge();
END;
$$;

REVOKE ALL ON FUNCTION public.get_daily_challenge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_challenge() TO authenticated;
