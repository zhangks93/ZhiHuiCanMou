import { useEffect, useState } from 'react'
import { fetchOrgDirectory } from '../api/orgRepository'
import type {
  DepartmentMemberChange,
  FeishuDepartment,
  FeishuMember,
  FeishuSyncRun,
  OrgDirectoryDataSource,
} from '../types'

export function useOrgDirectoryData() {
  const [departments, setDepartments] = useState<FeishuDepartment[]>([])
  const [members, setMembers] = useState<FeishuMember[]>([])
  const [latestSyncRun, setLatestSyncRun] = useState<FeishuSyncRun | null>(null)
  const [snapshotRuns, setSnapshotRuns] = useState<FeishuSyncRun[]>([])
  const [previousSnapshotDepartments, setPreviousSnapshotDepartments] = useState<FeishuDepartment[]>([])
  const [departmentChanges, setDepartmentChanges] = useState<DepartmentMemberChange[]>([])
  const [dataSource, setDataSource] = useState<OrgDirectoryDataSource>('live')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDirectory() {
      const {
        departments: nextDepartments,
        members: nextMembers,
        latestSyncRun: nextLatestSyncRun,
        snapshotRuns: nextSnapshotRuns,
        previousSnapshotDepartments: nextPreviousSnapshotDepartments,
        departmentChanges: nextDepartmentChanges,
        dataSource: nextDataSource,
      } = await fetchOrgDirectory()
      setDepartments(nextDepartments)
      setMembers(nextMembers)
      setLatestSyncRun(nextLatestSyncRun)
      setSnapshotRuns(nextSnapshotRuns)
      setPreviousSnapshotDepartments(nextPreviousSnapshotDepartments)
      setDepartmentChanges(nextDepartmentChanges)
      setDataSource(nextDataSource)
      setLoading(false)
    }

    void loadDirectory()
  }, [])

  return {
    departments,
    members,
    latestSyncRun,
    snapshotRuns,
    previousSnapshotDepartments,
    departmentChanges,
    dataSource,
    loading,
  }
}
