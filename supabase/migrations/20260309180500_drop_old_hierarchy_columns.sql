-- Drop old hierarchy columns from business data tables
-- Migration: 20260309180500_drop_old_hierarchy_columns.sql
-- Reason: Replaced by new org_* hierarchy fields (center_region, business_segment, report_level1, report_level2)

-- ============================================================
-- Drop old columns from edu_biz_report
-- ============================================================

ALTER TABLE edu_biz_report
  DROP COLUMN IF EXISTS parent_node_name,
  DROP COLUMN IF EXISTS node_level,
  DROP COLUMN IF EXISTS is_summary;

-- ============================================================
-- Drop old columns from edu_biz_monthly_plan
-- ============================================================

ALTER TABLE edu_biz_monthly_plan
  DROP COLUMN IF EXISTS parent_node_name,
  DROP COLUMN IF EXISTS node_level,
  DROP COLUMN IF EXISTS is_summary;
