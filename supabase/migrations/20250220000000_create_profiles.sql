-- Profiles table: extends auth.users with Feishu and app-specific data
-- Links Supabase user id to feishu_open_id for querying and RLS

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  feishu_open_id text UNIQUE NOT NULL,
  name text,
  avatar_url text,
  updated_at timestamptz DEFAULT now()
);

-- Index for looking up by Feishu ID
CREATE UNIQUE INDEX IF NOT EXISTS profiles_feishu_open_id_idx ON public.profiles(feishu_open_id);

-- RLS: users can read their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow insert for authenticated users (profile created on first login via Edge Function with service_role)
-- Service role bypasses RLS, so Edge Function inserts work without a policy

COMMENT ON TABLE public.profiles IS 'User profiles with Feishu open_id, synced on login';
