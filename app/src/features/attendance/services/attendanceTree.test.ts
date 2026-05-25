import { describe, expect, it } from 'vitest'
import { departmentRootKey, ROOT_ORG_NAME } from '@/shared/lib/orgConstants'
import {
  buildAttendanceTree,
  collectExpandableAttendanceKeys,
  filterAttendanceTree,
  flattenAttendanceTreeRows,
} from './attendanceTree'
import type { AttendanceMonthlyRecord } from '../api/attendanceRepository'

function record(overrides: Partial<AttendanceMonthlyRecord>): AttendanceMonthlyRecord {
  const base = {
    id: 'member-1',
    year_month: 202501,
    employee_name: '张三',
    employee_no: 'E001',
    department_path: [ROOT_ORG_NAME, '华东区域'],
    attendance_type: 'standard_day',
    expected_work_amount: 22,
    actual_work_amount: 20,
    qualified_attendance_amount: 19,
    attendance_rate: 0.86,
    paid_leave_amount: 0,
    unpaid_leave_amount: 0,
    late_under_30_count: 0,
    late_30_to_120_count: 0,
    late_total_count: 0,
    missing_clock_count: 0,
    makeup_clock_count: 0,
    approved_leave_amount: 0,
    created_at: '2026-01-01T00:00:00Z',
  }

  return { ...base, ...overrides } as AttendanceMonthlyRecord
}

describe('attendanceTree', () => {
  it('builds a root node with department and member children', () => {
    const tree = buildAttendanceTree([
      record({ id: 'member-1', employee_name: '张三' }),
      record({ id: 'member-2', employee_name: '李四', department_path: [ROOT_ORG_NAME, '华东区域'] }),
    ])

    expect(tree).toHaveLength(1)
    expect(tree[0].key).toBe(departmentRootKey())
    expect(tree[0].metrics.employeeCount).toBe(2)

    const hasMember = (rows: typeof tree): boolean =>
      rows.some((row) => row.level === 'member' || (row.children ? hasMember(row.children) : false))

    expect(hasMember(tree)).toBe(true)
  })

  it('filters tree rows by employee name', () => {
    const tree = buildAttendanceTree([
      record({ id: 'member-1', employee_name: '张三' }),
      record({ id: 'member-2', employee_name: '李四' }),
    ])
    const filtered = filterAttendanceTree(tree, '张三')
    const flattened = flattenAttendanceTreeRows(filtered, collectExpandableAttendanceKeys(filtered))

    expect(flattened.some((row) => row.name === '张三')).toBe(true)
    expect(flattened.some((row) => row.name === '李四')).toBe(false)
  })

  it('returns empty tree when no records exist', () => {
    expect(buildAttendanceTree([])).toEqual([])
  })
})
