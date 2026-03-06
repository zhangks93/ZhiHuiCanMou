-- Add UPDATE policy for org_settings
-- Allow users to update their org's settings

DROP POLICY IF EXISTS "Org members can update org_settings" ON public.org_settings;

CREATE POLICY "Org members can update org_settings"
  ON public.org_settings
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- Add INSERT policy for org_settings (for upsert operations)
DROP POLICY IF EXISTS "Org members can insert org_settings" ON public.org_settings;

CREATE POLICY "Org members can insert org_settings"
  ON public.org_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );
