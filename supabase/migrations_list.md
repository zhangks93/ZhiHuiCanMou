# Supabase Migrations

Last updated: 2026-05-14

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
| 20260324103000 | expand_opportunity_ledger_for_funnel_v2 | Add funnel v2 fields for project grouping, stage tracking, progress, and first-year revenue |
| 20260324153000 | redesign_opportunity_ledger_for_visible_sheets | Archive legacy table, create snapshot/detail tables, and align schema to visible workbook sheets |
| 20260328120000 | redesign_edu_org_hierarchy_for_flat_levels | Redesign edu_org_hierarchy to match the new mapping workbook headers (level_0, level_1, level_2, node_name) |
| 20260402110000 | add_schedule_time_range_constraints | Backfill schedule period from timed items and enforce valid time ranges |
| 20260423113000 | create_opportunity_ledger_v2 | Create a simplified opportunity ledger table for the new workbook structure |
| 20260423123000 | simplify_opportunity_ledger_v2 | Drop non-essential derived/import fields and keep only Excel fields plus snapshot metadata |
| 20260424110000 | create_edu_strategy_budget_plan | Create long-form table for sheet 5 five-year strategic budget planning data |
| 20260427143000 | create_fee_effect_analysis | Create fee-effect analysis import batches and 4 analysis sheet result tables, without raw detail fact tables |
| 20260427150000 | disable_rls_for_fee_effect_tables | Disable RLS for fee-effect analysis tables per data module import requirement |
| 20260503170000 | create_attendance_monthly_records_v2 | Create HR monthly attendance v2 table for both day-based and hour-based attendance workbooks |
| 20260514120000 | create_collection_receivables | Create collection receivables table for cumulative collection rate workbook data |

## Total Migrations: 27

## Latest Migration
**Version**: 20260514120000
**Name**: create_collection_receivables
**Date**: 2026-05-14

This migration creates `edu_collection_receivables`:
- Stores cumulative collection workbook rows with amounts normalized to 万元
- Preserves the Excel parent record relationship for tree table display
- Grants authenticated read access without enabling RLS
