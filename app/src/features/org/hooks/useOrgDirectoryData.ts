import { useEffect, useState } from 'react'
import type { FeishuDepartment, FeishuMember } from '@/lib/supabase'
import { fetchOrgDirectory } from '../api/orgRepository'

export function useOrgDirectoryData() {
  const [departments, setDepartments] = useState<FeishuDepartment[]>([])
  const [members, setMembers] = useState<FeishuMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDirectory() {
      const { departments: nextDepartments, members: nextMembers } = await fetchOrgDirectory()
      setDepartments(nextDepartments)
      setMembers(nextMembers)
      setLoading(false)
    }

    void loadDirectory()
  }, [])

  return {
    departments,
    members,
    loading,
  }
}
