import { useEffect, useState } from 'react'
import { fetchOrgDirectory } from '../api/orgRepository'
import type { DepartmentMemberChange, FeishuDepartment, FeishuMember, FeishuSyncRun } from '../types'

export function useOrgDirectoryData() {
  const [departments, setDepartments] = useState<FeishuDepartment[]>([])
  const [members, setMembers] = useState<FeishuMember[]>([])
  const [latestSyncRun, setLatestSyncRun] = useState<FeishuSyncRun | null>(null)
  const [snapshotRuns, setSnapshotRuns] = useState<FeishuSyncRun[]>([])
  const [departmentChanges, setDepartmentChanges] = useState<DepartmentMemberChange[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDirectory() {
      const {
        departments: nextDepartments,
        members: nextMembers,
        latestSyncRun: nextLatestSyncRun,
        snapshotRuns: nextSnapshotRuns,
        departmentChanges: nextDepartmentChanges,
      } = await fetchOrgDirectory()
      setDepartments(nextDepartments)
      setMembers(nextMembers)
      setLatestSyncRun(nextLatestSyncRun)
      setSnapshotRuns(nextSnapshotRuns)
      setDepartmentChanges(nextDepartmentChanges)
      setLoading(false)
    }

    void loadDirectory()
  }, [])

  return {
    departments,
    members,
    latestSyncRun,
    snapshotRuns,
    departmentChanges,
    loading,
  }
}
