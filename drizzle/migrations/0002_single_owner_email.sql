CREATE OR REPLACE FUNCTION public.bootstrap_owner_on_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.role := 'member';
  IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = NEW.id AND u.email_confirmed_at IS NOT NULL
             AND lower(u.email) = 'hoppinfour20@gmail.com') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner') ON CONFLICT DO NOTHING;
    NEW.role := 'owner';
  ELSIF public.has_role(NEW.id, 'owner') THEN
    NEW.role := 'owner';
  END IF;
  RETURN NEW;
END $$;