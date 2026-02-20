-- Migration: Create schedule_items, org_data, biz_data, opportunities tables
-- Project: kwwoyzaeczecddilwajs

-- 1. schedule_items - 日程表
CREATE TABLE IF NOT EXISTS schedule_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  type text CHECK (type IN ('meeting', 'business', 'routine', 'urgent')),
  location text,
  created_at timestamptz DEFAULT now()
);

-- 2. org_data - 组织数据表
CREATE TABLE IF NOT EXISTS org_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  total_count integer NOT NULL,
  details jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- 3. biz_data - 业务数据表
CREATE TABLE IF NOT EXISTS biz_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_unit text NOT NULL,
  budget_revenue numeric NOT NULL,
  actual_revenue numeric NOT NULL,
  budget_profit numeric NOT NULL,
  actual_profit numeric NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- 4. opportunities - 商机表
CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL,
  stage text NOT NULL,
  level text CHECK (level IN ('A', 'B', 'C')),
  region text,
  owner text,
  created_at timestamptz DEFAULT now()
);
