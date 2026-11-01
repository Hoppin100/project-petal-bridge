CREATE TABLE public.admin_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  update_type text NOT NULL CHECK (update_type IN ('feature', 'improvement', 'fix', 'other')),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 2000),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.admin_updates TO authenticated;
ALTER TABLE public.admin_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_updates_select_owners ON public.admin_updates
  FOR SELECT TO authenticated USING (public.is_owner());

CREATE POLICY admin_updates_insert_owners ON public.admin_updates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() AND created_by = auth.uid());

CREATE POLICY admin_updates_delete_owners ON public.admin_updates
  FOR DELETE TO authenticated USING (public.is_owner());
