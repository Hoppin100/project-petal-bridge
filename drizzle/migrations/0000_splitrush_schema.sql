CREATE TYPE public.app_role AS ENUM ('owner', 'member');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','owner')),
  bio text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_lower_key ON public.profiles (lower(username));
GRANT SELECT (id, username, role, bio, avatar_url, created_at) ON public.profiles TO anon, authenticated;
GRANT INSERT (id, username) ON public.profiles TO authenticated;
GRANT UPDATE (username, bio, avatar_url) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Roles live in their own table; profiles.role is a read-only mirror.
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'owner')
$$;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

CREATE OR REPLACE FUNCTION public.sync_profile_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.profiles SET role = CASE WHEN public.has_role(v_uid,'owner') THEN 'owner' ELSE 'member' END, updated_at = now()
  WHERE id = v_uid;
  RETURN NULL;
END $$;
CREATE TRIGGER user_roles_sync AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role();

-- Designated owners are promoted when their profile is created, only if their email is confirmed.
CREATE OR REPLACE FUNCTION public.bootstrap_owner_on_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.role := 'member';
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.id AND u.email_confirmed_at IS NOT NULL
             AND lower(u.email) IN ('hoppinfour20@gmail.com','xavier.durand@msad60.org')) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
    NEW.role := 'owner';
  ELSIF public.has_role(NEW.id, 'owner') THEN
    NEW.role := 'owner';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_bootstrap_owner BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.bootstrap_owner_on_profile();

CREATE TABLE public.reserved_usernames (name text PRIMARY KEY);
GRANT SELECT ON public.reserved_usernames TO anon, authenticated;
GRANT ALL ON public.reserved_usernames TO service_role;
ALTER TABLE public.reserved_usernames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reserved_select_all" ON public.reserved_usernames FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.reserved_usernames (name) VALUES
 ('admin'),('owner'),('moderator'),('mod'),('system'),('splitrush'),('official'),('root'),('staff'),('support'),('verifier'),('bot'),('automation'),('null'),('undefined'),('anonymous');

CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  cover_url text,
  blurb text,
  page_url text,
  source text,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.games TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.games TO authenticated;
GRANT ALL ON public.games TO service_role;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "games_select_all" ON public.games FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "games_insert_owner" ON public.games FOR INSERT TO authenticated WITH CHECK (public.is_owner());
CREATE POLICY "games_update_owner" ON public.games FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "games_delete_owner" ON public.games FOR DELETE TO authenticated USING (public.is_owner());

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  parent_category_id uuid,
  name text NOT NULL,
  timing_rules text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, name),
  UNIQUE (id, game_id),
  CONSTRAINT categories_parent_not_self_check CHECK (parent_category_id IS NULL OR parent_category_id <> id)
);
ALTER TABLE public.categories ADD CONSTRAINT categories_parent_same_game_fkey
  FOREIGN KEY (parent_category_id, game_id) REFERENCES public.categories (id, game_id) ON DELETE CASCADE;
CREATE INDEX categories_parent_order_idx ON public.categories (parent_category_id, sort_order, name);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_select_all" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_insert_owner" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_owner());
CREATE POLICY "categories_update_owner" ON public.categories FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "categories_delete_owner" ON public.categories FOR DELETE TO authenticated USING (public.is_owner());

CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  runner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  time_ms bigint NOT NULL CHECK (time_ms > 0),
  platform text NOT NULL DEFAULT 'Unknown',
  video_url text NOT NULL,
  video_id text,
  video_start_seconds integer CHECK (video_start_seconds IS NULL OR video_start_seconds >= 0),
  video_end_seconds integer CHECK (video_end_seconds IS NULL OR video_end_seconds >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  rejection_reason text,
  verified_by uuid REFERENCES public.profiles(id),
  verified_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX runs_game_category_idx ON public.runs (game_id, category_id);
CREATE INDEX runs_runner_idx ON public.runs (runner_id);
CREATE INDEX runs_status_idx ON public.runs (status);
GRANT SELECT ON public.runs TO anon, authenticated;
GRANT INSERT (game_id, category_id, time_ms, platform, video_url, video_id, notes, video_start_seconds, video_end_seconds) ON public.runs TO authenticated;
GRANT UPDATE (notes) ON public.runs TO authenticated;
GRANT ALL ON public.runs TO service_role;
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_select_all" ON public.runs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "runs_insert_own" ON public.runs FOR INSERT TO authenticated WITH CHECK (auth.uid() = runner_id);
CREATE POLICY "runs_update_own" ON public.runs FOR UPDATE TO authenticated USING (auth.uid() = runner_id) WITH CHECK (auth.uid() = runner_id);

CREATE TABLE public.reference_examples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.runs(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (label IN ('verified','rejected')),
  notes text,
  marked_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reference_examples_game_cat_idx ON public.reference_examples (game_id, category_id);
GRANT SELECT ON public.reference_examples TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reference_examples TO authenticated;
GRANT ALL ON public.reference_examples TO service_role;
ALTER TABLE public.reference_examples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reference_select_all" ON public.reference_examples FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reference_owner_write" ON public.reference_examples FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.ai_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.runs(id) ON DELETE CASCADE,
  recommendation text NOT NULL CHECK (recommendation IN ('likely_consistent','needs_review','potential_concern')),
  confidence numeric(3,2),
  explanation text NOT NULL,
  evidence_basis text NOT NULL CHECK (evidence_basis IN ('video_analysis','metadata','statistical','incomplete')),
  observed_evidence text,
  speculation text,
  model_version text NOT NULL,
  input_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reference_example_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_assessments TO anon, authenticated;
GRANT ALL ON public.ai_assessments TO service_role;
ALTER TABLE public.ai_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_select_all" ON public.ai_assessments FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.assessment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assessment_history_run_idx ON public.assessment_history (run_id);
GRANT SELECT ON public.assessment_history TO anon, authenticated;
GRANT ALL ON public.assessment_history TO service_role;
ALTER TABLE public.assessment_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "history_select_all" ON public.assessment_history FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.game_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  rule_text text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.game_rules TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.game_rules TO authenticated;
GRANT ALL ON public.game_rules TO service_role;
ALTER TABLE public.game_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_select_all" ON public.game_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "rules_owner_write" ON public.game_rules FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

CREATE TABLE public.game_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_name text NOT NULL CHECK (length(trim(game_name)) BETWEEN 2 AND 100),
  game_url text NOT NULL CHECK (length(trim(game_url)) BETWEEN 8 AND 2048),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX game_requests_status_created_idx ON public.game_requests (status, created_at DESC);
GRANT INSERT (requester_id, game_name, game_url) ON public.game_requests TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.game_requests TO authenticated;
GRANT ALL ON public.game_requests TO service_role;
ALTER TABLE public.game_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_requests_insert_own" ON public.game_requests FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "game_requests_owner_select" ON public.game_requests FOR SELECT TO authenticated USING (public.is_owner());
CREATE POLICY "game_requests_owner_update" ON public.game_requests FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "game_requests_owner_delete" ON public.game_requests FOR DELETE TO authenticated USING (public.is_owner());

CREATE OR REPLACE FUNCTION public.set_member_role(p_member uuid, p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_role NOT IN ('member','owner') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF p_role = 'owner' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (p_member, 'owner') ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.user_roles WHERE user_id = p_member AND role = 'owner';
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_run(p_run uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.runs SET status='verified', verified_by=auth.uid(), verified_at=now(), rejection_reason=NULL WHERE id=p_run;
  INSERT INTO public.assessment_history (run_id, action, detail, actor_id) VALUES (p_run,'owner_verified','{}'::jsonb,auth.uid());
END $$;
REVOKE EXECUTE ON FUNCTION public.verify_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_run(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_run(p_run uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.runs SET status='rejected', verified_by=auth.uid(), verified_at=now(), rejection_reason=p_reason WHERE id=p_run;
  INSERT INTO public.assessment_history (run_id, action, detail, actor_id) VALUES (p_run,'owner_rejected',jsonb_build_object('reason',p_reason),auth.uid());
END $$;
REVOKE EXECUTE ON FUNCTION public.reject_run(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_run(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_run(p_run uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Only owners can delete runs'; END IF;
  DELETE FROM public.runs WHERE id = p_run;
  IF NOT FOUND THEN RAISE EXCEPTION 'Run not found'; END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public.delete_run(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_run(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_assessment(
  p_run_id uuid, p_recommendation text, p_confidence numeric, p_explanation text, p_evidence_basis text,
  p_observed_evidence text, p_speculation text, p_model_version text, p_input_evidence jsonb, p_reference_example_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_recommendation NOT IN ('likely_consistent','needs_review','potential_concern') THEN RAISE EXCEPTION 'Invalid recommendation'; END IF;
  IF p_evidence_basis NOT IN ('video_analysis','metadata','statistical','incomplete') THEN RAISE EXCEPTION 'Invalid evidence basis'; END IF;
  INSERT INTO public.ai_assessments (run_id, recommendation, confidence, explanation, evidence_basis, observed_evidence, speculation, model_version, input_evidence, reference_example_ids)
  VALUES (p_run_id, p_recommendation, p_confidence, p_explanation, p_evidence_basis, p_observed_evidence, p_speculation, p_model_version, p_input_evidence, p_reference_example_ids)
  ON CONFLICT (run_id) DO UPDATE SET recommendation=EXCLUDED.recommendation, confidence=EXCLUDED.confidence, explanation=EXCLUDED.explanation,
    evidence_basis=EXCLUDED.evidence_basis, observed_evidence=EXCLUDED.observed_evidence, speculation=EXCLUDED.speculation,
    model_version=EXCLUDED.model_version, input_evidence=EXCLUDED.input_evidence, reference_example_ids=EXCLUDED.reference_example_ids, updated_at=now()
  RETURNING id INTO v_id;
  INSERT INTO public.assessment_history (run_id, action, detail) VALUES (p_run_id,'assessment_recorded',
    jsonb_build_object('recommendation',p_recommendation,'confidence',p_confidence,'model_version',p_model_version,'evidence_basis',p_evidence_basis));
  RETURN v_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_assessment(uuid,text,numeric,text,text,text,text,text,jsonb,uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_assessment(uuid,text,numeric,text,text,text,text,text,jsonb,uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION public.check_username_available(p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text := btrim(p_username);
BEGIN
  IF v IS NULL OR length(v) < 3 OR length(v) > 20 OR v !~ '^[A-Za-z0-9_]+$' THEN RETURN 'invalid_format'; END IF;
  IF EXISTS (SELECT 1 FROM public.reserved_usernames WHERE lower(name)=lower(v)) THEN RETURN 'reserved'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username)=lower(v)) THEN RETURN 'taken'; END IF;
  RETURN 'available';
END $$;
REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.reorder_categories(p_game_id uuid, p_category_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_expected integer; v_matching integer; v_unique integer;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'Only owners can reorder categories'; END IF;
  PERFORM 1 FROM public.games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Game not found'; END IF;
  SELECT count(*) INTO v_expected FROM public.categories WHERE game_id = p_game_id;
  SELECT count(*), count(DISTINCT s.id) INTO v_matching, v_unique
    FROM unnest(p_category_ids) AS s(id) JOIN public.categories c ON c.id = s.id AND c.game_id = p_game_id;
  IF COALESCE(array_length(p_category_ids,1),0) <> v_expected OR v_matching <> v_expected OR v_unique <> v_expected THEN
    RAISE EXCEPTION 'Category order must contain each category for this game exactly once';
  END IF;
  UPDATE public.categories c SET sort_order = o.ordinality * 10
    FROM unnest(p_category_ids) WITH ORDINALITY AS o(id, ordinality) WHERE c.id = o.id AND c.game_id = p_game_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.reorder_categories(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_categories(uuid, uuid[]) TO authenticated;