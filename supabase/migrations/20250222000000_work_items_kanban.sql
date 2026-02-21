-- Extend work_items for Jira-like kanban: title, priority, extended statuses

-- Add new columns
ALTER TABLE public.work_items
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Migrate existing content to title where title is null
UPDATE public.work_items SET title = LEFT(COALESCE(content, '未命名'), 80) WHERE title IS NULL OR title = '';

-- Drop old status constraint
ALTER TABLE public.work_items DROP CONSTRAINT IF EXISTS work_items_status_check;

-- Migrate old status values first (before adding new constraint)
UPDATE public.work_items SET status = 'todo' WHERE status = 'draft';
UPDATE public.work_items SET status = 'in_progress' WHERE status = 'submitted';
UPDATE public.work_items SET status = 'done' WHERE status = 'approved';
UPDATE public.work_items SET status = 'todo' WHERE status NOT IN ('todo','in_progress','in_review','done');
UPDATE public.work_items SET priority = 'medium' WHERE priority IS NULL;

-- Add new status constraint
ALTER TABLE public.work_items ADD CONSTRAINT work_items_status_check
  CHECK (status IN ('todo', 'in_progress', 'in_review', 'done'));

-- Set default for new rows
ALTER TABLE public.work_items ALTER COLUMN status SET DEFAULT 'todo';

COMMENT ON COLUMN public.work_items.title IS 'Card title for kanban display';
COMMENT ON COLUMN public.work_items.priority IS 'Priority: low, medium, high, urgent';
