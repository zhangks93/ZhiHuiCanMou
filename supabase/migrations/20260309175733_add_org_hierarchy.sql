-- Add organization hierarchy columns to business data tables
-- Migration: 20260309175733_add_org_hierarchy.sql

-- ============================================================
-- Add hierarchy columns to edu_biz_report
-- ============================================================

ALTER TABLE edu_biz_report
  ADD COLUMN center_region TEXT,           -- 中心/区域 (Level 1)
  ADD COLUMN business_segment TEXT,        -- 板块业务分类 (Level 2)
  ADD COLUMN report_level1 TEXT,           -- 分析汇报一级 (Level 3)
  ADD COLUMN report_level2 TEXT,           -- 分析汇报二级 (Level 4)
  ADD COLUMN is_aggregated BOOLEAN DEFAULT FALSE,  -- 标记合计/小计行
  ADD COLUMN aggregation_level TEXT;       -- 合计层级 (total/group/center/region/segment/etc)

-- Add indexes for common query patterns
CREATE INDEX idx_edu_biz_report_center ON edu_biz_report(center_region);
CREATE INDEX idx_edu_biz_report_segment ON edu_biz_report(business_segment);
CREATE INDEX idx_edu_biz_report_level1 ON edu_biz_report(report_level1);
CREATE INDEX idx_edu_biz_report_level2 ON edu_biz_report(report_level2);
CREATE INDEX idx_edu_biz_report_aggregated ON edu_biz_report(is_aggregated);

-- Add column comments
COMMENT ON COLUMN edu_biz_report.center_region IS '中心/区域 (Level 1): 后勤管理中心, 三大区域, etc.';
COMMENT ON COLUMN edu_biz_report.business_segment IS '板块业务分类 (Level 2): 教育园特色餐饮, 西南区域, etc.';
COMMENT ON COLUMN edu_biz_report.report_level1 IS '分析汇报一级 (Level 3): Primary reporting unit';
COMMENT ON COLUMN edu_biz_report.report_level2 IS '分析汇报二级 (Level 4): Secondary tag/category';
COMMENT ON COLUMN edu_biz_report.is_aggregated IS '是否为合计/小计行 (true for 合计/小计/总计 rows)';
COMMENT ON COLUMN edu_biz_report.aggregation_level IS '合计层级标识: total/group/center/region/segment/department/business/unit/category';

-- ============================================================
-- Add hierarchy columns to edu_biz_monthly_plan
-- ============================================================

ALTER TABLE edu_biz_monthly_plan
  ADD COLUMN center_region TEXT,
  ADD COLUMN business_segment TEXT,
  ADD COLUMN report_level1 TEXT,
  ADD COLUMN report_level2 TEXT,
  ADD COLUMN is_aggregated BOOLEAN DEFAULT FALSE,
  ADD COLUMN aggregation_level TEXT;

-- Add indexes
CREATE INDEX idx_edu_biz_monthly_plan_center ON edu_biz_monthly_plan(center_region);
CREATE INDEX idx_edu_biz_monthly_plan_segment ON edu_biz_monthly_plan(business_segment);
CREATE INDEX idx_edu_biz_monthly_plan_level1 ON edu_biz_monthly_plan(report_level1);
CREATE INDEX idx_edu_biz_monthly_plan_level2 ON edu_biz_monthly_plan(report_level2);
CREATE INDEX idx_edu_biz_monthly_plan_aggregated ON edu_biz_monthly_plan(is_aggregated);

-- Add column comments
COMMENT ON COLUMN edu_biz_monthly_plan.center_region IS '中心/区域 (Level 1)';
COMMENT ON COLUMN edu_biz_monthly_plan.business_segment IS '板块业务分类 (Level 2)';
COMMENT ON COLUMN edu_biz_monthly_plan.report_level1 IS '分析汇报一级 (Level 3)';
COMMENT ON COLUMN edu_biz_monthly_plan.report_level2 IS '分析汇报二级 (Level 4)';
COMMENT ON COLUMN edu_biz_monthly_plan.is_aggregated IS '是否为合计/小计行';
COMMENT ON COLUMN edu_biz_monthly_plan.aggregation_level IS '合计层级标识';
