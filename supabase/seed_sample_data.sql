-- Sample data for Canmou project (Chinese business data)
-- Run this AFTER applying the migration

-- schedule_items - 日程表 (2-3 rows)
INSERT INTO schedule_items (title, description, start_time, end_time, type, location) VALUES
  ('华东区季度销售会议', '讨论Q1销售目标及区域策略', '2025-02-20 09:00:00+08', '2025-02-20 11:00:00+08', 'meeting', '上海总部3楼会议室'),
  ('拜访杭州客户', '跟进智能制造项目合作意向', '2025-02-21 14:00:00+08', '2025-02-21 17:00:00+08', 'business', '杭州市滨江区'),
  ('每日晨会', '团队同步当日工作安排', '2025-02-19 08:30:00+08', '2025-02-19 09:00:00+08', 'routine', '线上会议');

-- org_data - 组织数据表 (2-3 rows)
INSERT INTO org_data (name, total_count, details) VALUES
  ('销售部', 45, '{"departments": ["华东区", "华南区", "华北区"], "headcount_plan": 50}'),
  ('研发中心', 128, '{"teams": ["前端组", "后端组", "算法组"], "projects_active": 12}'),
  ('市场部', 23, '{"regions": ["一线城市", "新一线"], "budget_allocated": 5000000}');

-- biz_data - 业务数据表 (2-3 rows)
INSERT INTO biz_data (business_unit, budget_revenue, actual_revenue, budget_profit, actual_profit) VALUES
  ('华东区', 50000000, 48500000, 8000000, 7650000),
  ('华南区', 35000000, 37200000, 5600000, 5950000),
  ('华北区', 28000000, 26200000, 4200000, 3850000);

-- opportunities - 商机表 (2-3 rows)
INSERT INTO opportunities (name, amount, stage, level, region, owner) VALUES
  ('某大型制造企业数字化转型项目', 8500000, '商务谈判', 'A', '华东', '张明'),
  ('智慧城市物联网平台建设', 3200000, '方案评审', 'B', '华南', '李华'),
  ('企业级SaaS订阅服务', 1200000, '需求确认', 'C', '华北', '王芳');
