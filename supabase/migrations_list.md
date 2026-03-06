# Supabase Migrations

Last updated: 2026-03-06

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

## Total Migrations: 12

## Latest Migration
**Version**: 20260305100546
**Name**: redesign_attendance_records_with_departments
**Date**: 2026-03-05

This migration redesigned the attendance system to properly integrate with Feishu departments and members, establishing foreign key relationships for data integrity.
