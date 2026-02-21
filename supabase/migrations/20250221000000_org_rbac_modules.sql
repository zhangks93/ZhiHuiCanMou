-- Phase 1: Organization structure, RBAC, module configuration
-- Supports multi-level hierarchy: president | director | manager | supervisor

-- 1. organizations - tenant root (multi-tenant ready)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. org_nodes - organizational tree (departments, teams)
CREATE TABLE IF NOT EXISTS public.org_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.org_nodes(id) ON DELETE CASCADE,
  name text NOT NULL,
  path text,  -- materialized path for subtree queries, e.g. '/root/dept1/team-a'
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS org_nodes_org_id_idx ON public.org_nodes(org_id);
CREATE INDEX IF NOT EXISTS org_nodes_parent_id_idx ON public.org_nodes(parent_id);

-- 3. Extend profiles with role, org, and reporting chain
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_node_id uuid REFERENCES public.org_nodes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reports_to_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS role text CHECK (role IN ('president', 'director', 'manager', 'supervisor'));

CREATE INDEX IF NOT EXISTS profiles_org_id_idx ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS profiles_org_node_id_idx ON public.profiles(org_node_id);
CREATE INDEX IF NOT EXISTS profiles_reports_to_id_idx ON public.profiles(reports_to_id);

-- 4. org_settings - tenant-level module config and permissions
CREATE TABLE IF NOT EXISTS public.org_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
  enabled_module_ids text[] DEFAULT ARRAY['schedule', 'org-data', 'biz-data', 'opportunity', 'competitor', 'trip', 'attendance', 'links', 'ai'],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_settings_org_id_idx ON public.org_settings(org_id);

-- 5. modules registry - static definition of available modules
CREATE TABLE IF NOT EXISTS public.modules (
  id text PRIMARY KEY,
  name text NOT NULL,
  section text NOT NULL,  -- workbench | data-center | business | tools
  route_path text NOT NULL,
  sort_order integer DEFAULT 0,
  reporter_view_enabled boolean DEFAULT true,
  manager_view_enabled boolean DEFAULT true
);

-- Seed default organization for single-tenant
INSERT INTO public.organizations (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', '默认组织')
ON CONFLICT (id) DO NOTHING;

-- Seed default org_settings
INSERT INTO public.org_settings (org_id, enabled_module_ids) VALUES
  ('00000000-0000-0000-0000-000000000001', ARRAY['work-report', 'schedule', 'org-data', 'biz-data', 'opportunity', 'competitor', 'trip', 'attendance', 'links', 'ai'])
ON CONFLICT (org_id) DO NOTHING;

-- Seed default modules
INSERT INTO public.modules (id, name, section, route_path, sort_order) VALUES
  ('work-report', '工作汇报', 'workbench', '/work-report', 5),
  ('schedule', '日程提醒', 'workbench', '/schedule', 10),
  ('org-data', '常用数据', 'data-center', '/org-data', 20),
  ('biz-data', '经营数据', 'data-center', '/biz-data', 21),
  ('opportunity', '商机管理', 'business', '/opportunity', 30),
  ('competitor', '竞对档案', 'business', '/competitor', 31),
  ('trip', '出差管理', 'business', '/trip', 32),
  ('attendance', '考勤管理', 'business', '/attendance', 33),
  ('links', '系统链接', 'tools', '/links', 40),
  ('ai', '智能分析', 'tools', '/ai', 41)
ON CONFLICT (id) DO NOTHING;

-- 6. RLS for organizations (single-tenant: all authenticated can read)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

-- 7. RLS for org_nodes
ALTER TABLE public.org_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view org_nodes"
  ON public.org_nodes FOR SELECT
  TO authenticated
  USING (true);

-- 8. RLS for org_settings - users in same org can read
ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view org_settings"
  ON public.org_settings FOR SELECT
  TO authenticated
  USING (
    org_id IN (SELECT org_id FROM public.profiles WHERE id = auth.uid())
  );

-- 9. modules - read-only for all
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view modules"
  ON public.modules FOR SELECT
  TO authenticated
  USING (true);

-- 10. Helper: get subordinate user IDs (direct + transitive via reports_to chain)
-- Used by RLS for work_items visibility (Phase 2)
CREATE OR REPLACE FUNCTION public.get_subordinate_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH RECURSIVE subordinates AS (
    SELECT id FROM public.profiles WHERE reports_to_id = p_user_id
    UNION ALL
    SELECT p.id FROM public.profiles p
    JOIN subordinates s ON p.reports_to_id = s.id
  )
  SELECT id FROM subordinates;
$$;

COMMENT ON TABLE public.org_nodes IS 'Organizational tree for hierarchy-based permissions';
COMMENT ON TABLE public.org_settings IS 'Tenant-level config: enabled modules, etc.';
COMMENT ON TABLE public.modules IS 'Registry of available pluggable modules';
