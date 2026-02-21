-- Phase 2: work_items - unified work progress reporting
-- Reporter adds entries; manager sees subordinates' items (RLS)

CREATE TABLE IF NOT EXISTS public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module_id text NOT NULL,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  links jsonb DEFAULT '[]'::jsonb,  -- [{ "url": "...", "title": "飞书文档" }]
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  period_start date,
  period_end date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS work_items_org_id_idx ON public.work_items(org_id);
CREATE INDEX IF NOT EXISTS work_items_module_id_idx ON public.work_items(module_id);
CREATE INDEX IF NOT EXISTS work_items_reporter_id_idx ON public.work_items(reporter_id);
CREATE INDEX IF NOT EXISTS work_items_period_idx ON public.work_items(period_start, period_end);

-- RLS: reporters see own; managers see subordinates (via get_subordinate_ids)
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own work_items"
  ON public.work_items FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "Managers can view subordinates work_items"
  ON public.work_items FOR SELECT
  TO authenticated
  USING (
    reporter_id IN (SELECT public.get_subordinate_ids(auth.uid()))
  );

CREATE POLICY "Users can insert own work_items"
  ON public.work_items FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can update own work_items"
  ON public.work_items FOR UPDATE
  TO authenticated
  USING (reporter_id = auth.uid())
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can delete own work_items"
  ON public.work_items FOR DELETE
  TO authenticated
  USING (reporter_id = auth.uid());

COMMENT ON TABLE public.work_items IS 'Work progress entries: reporters add, managers view subordinates';
COMMENT ON COLUMN public.work_items.links IS 'Feishu doc/sheet URLs: [{ url, title }]';
