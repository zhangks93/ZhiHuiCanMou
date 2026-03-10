# Supabase Migrations

Last updated: 2026-03-09

## Migration History

| Version | Name | Description |
|---------|------|-------------|
| 20260225142019 | create_opportunity_ledger | Create opportunity ledger table for tracking business opportunities |
| 20260226065302 | create_biz_data_snapshot | Create business data snapshot table |
| 20260302020321 | add_schedule_period_and_notes | Add period and meeting_notes fields to schedule_items |
| 20260303011322 | create_edu_logistics_biz_data | Create education logistics business data table |
| 20260303084658 | create_employees_table | Create employees table |
| 20260303084742 | create_attendance_records_table | Create attendance records table |
| 20260303085040 | alter_attendance_records_nullable | Alter attendance records to make fields nullable |
| 20260304022151 | create_attendance_tables | Create comprehensive attendance tables |
| 20260305011956 | create_feishu_contacts | Create Feishu contacts integration tables |
| 20260305031623 | change_member_department_ids_to_text | Change member department_ids from array to text |
| 20260305092745 | clean_and_migrate_attendance_to_feishu | Clean and migrate attendance data to Feishu structure |
| 20260305100546 | redesign_attendance_records_with_departments | Redesign attendance records with proper department integration |
| 20260309073508 | create_edu_biz_report_tables | Create edu_biz_report and edu_biz_monthly_plan tables for 25学年经营数据 |
| 20260309175733 | add_org_hierarchy | Add organization hierarchy columns to edu_biz_report and edu_biz_monthly_plan |
| 20260309180500 | drop_old_hierarchy_columns | Drop old hierarchy columns (parent_node_name, node_level, is_summary) from edu_biz tables |
| 20260310034500 | simplify_biz_tables_and_add_org_hierarchy | Remove hierarchy columns from biz tables, create edu_org_hierarchy table |

## Total Migrations: 16

## Latest Migration
**Version**: 20260310034500
**Name**: simplify_biz_tables_and_add_org_hierarchy
**Date**: 2026-03-10

This migration simplified the business data tables and created a separate hierarchy table:
- Removed all hierarchy columns after `created_at` from `edu_biz_report` and `edu_biz_monthly_plan`
- Created new `edu_org_hierarchy` table with columns: `node_name`, `level_1`, `level_2`, `level_3`, `label`
- Added indexes on `node_name` for efficient JOIN operations
- Hierarchy data is now maintained separately and joined via `node_name`
