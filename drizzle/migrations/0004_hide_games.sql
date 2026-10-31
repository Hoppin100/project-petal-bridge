ALTER TABLE public.games
  ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_role_check,
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('member', 'moderator', 'owner'));

CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.profiles
  SET role = CASE
    WHEN public.has_role(v_uid, 'owner') THEN 'owner'
    WHEN public.has_role(v_uid, 'moderator') THEN 'moderator'
    ELSE 'member'
  END,
  updated_at = now()
  WHERE id = v_uid;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.bootstrap_owner_on_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.role := 'member';
  IF EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = NEW.id
      AND u.email_confirmed_at IS NOT NULL
      AND lower(u.email) = 'hoppinfour20@gmail.com'
  ) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
    NEW.role := 'owner';
  ELSIF public.has_role(NEW.id, 'owner') THEN
    NEW.role := 'owner';
  ELSIF public.has_role(NEW.id, 'moderator') THEN
    NEW.role := 'moderator';
  END IF;
  RETURN NEW;
END $$;

UPDATE public.profiles p
SET role = CASE
  WHEN public.has_role(p.id, 'owner') THEN 'owner'
  WHEN public.has_role(p.id, 'moderator') THEN 'moderator'
  ELSE 'member'
END;

CREATE OR REPLACE FUNCTION public.is_game_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'owner')
      OR public.has_role(auth.uid(), 'moderator')
$$;
REVOKE EXECUTE ON FUNCTION public.is_game_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_game_staff() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_game_under_construction(p_slug text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.games
    WHERE slug = p_slug AND is_hidden
  ) AND NOT public.is_game_staff()
$$;
REVOKE EXECUTE ON FUNCTION public.is_game_under_construction(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_game_under_construction(text) TO anon, authenticated;

DROP POLICY IF EXISTS "games_select_all" ON public.games;
CREATE POLICY games_select_visible ON public.games FOR SELECT TO anon, authenticated
  USING (NOT is_hidden OR public.is_game_staff());

DROP POLICY IF EXISTS "categories_select_all" ON public.categories;
CREATE POLICY categories_select_visible ON public.categories FOR SELECT TO anon, authenticated
  USING (
    public.is_game_staff()
    OR EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND NOT g.is_hidden
    )
  );

DROP POLICY IF EXISTS runs_select_visible ON public.runs;
CREATE POLICY runs_select_visible ON public.runs FOR SELECT TO anon, authenticated
  USING (
    runner_id = auth.uid()
    OR public.is_game_staff()
    OR (
      status = 'verified'
      AND EXISTS (
        SELECT 1 FROM public.games g
        WHERE g.id = game_id AND NOT g.is_hidden
      )
    )
  );

DROP POLICY IF EXISTS "rules_select_all" ON public.game_rules;
CREATE POLICY rules_select_visible ON public.game_rules FOR SELECT TO anon, authenticated
  USING (
    public.is_game_staff()
    OR EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND NOT g.is_hidden
    )
  );
