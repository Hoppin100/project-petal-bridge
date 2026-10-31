DROP POLICY IF EXISTS runs_select_all ON public.runs;
CREATE POLICY runs_select_visible ON public.runs FOR SELECT TO anon, authenticated
  USING (status = 'verified' OR runner_id = auth.uid() OR public.is_owner());

DROP POLICY IF EXISTS ai_select_all ON public.ai_assessments;
CREATE POLICY ai_select_owner_or_runner ON public.ai_assessments FOR SELECT TO authenticated
  USING (public.is_owner() OR EXISTS (SELECT 1 FROM public.runs r WHERE r.id = run_id AND r.runner_id = auth.uid()));

DROP POLICY IF EXISTS history_select_all ON public.assessment_history;
CREATE POLICY history_select_owner ON public.assessment_history FOR SELECT TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS reference_select_all ON public.reference_examples;
CREATE POLICY reference_select_owner ON public.reference_examples FOR SELECT TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS reserved_select_all ON public.reserved_usernames;
CREATE POLICY reserved_select_owner ON public.reserved_usernames FOR SELECT TO authenticated
  USING (public.is_owner());