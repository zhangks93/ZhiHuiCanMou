import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getCurrentAuthUser } from './scheduleRepository'

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
  },
}))

vi.mock('@/shared/lib/tauri', () => ({
  invokeTauri: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
}))

import { supabase } from '@/shared/lib/supabase'

describe('scheduleRepository auth helpers', () => {
  beforeEach(() => {
    vi.mocked(supabase.auth.getUser).mockReset()
  })

  it('returns user id when session is valid', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as never)

    await expect(getCurrentAuthUser()).resolves.toEqual({ userId: 'user-123' })
  })

  it('throws when user is missing', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as never)

    await expect(getCurrentAuthUser()).rejects.toThrow('当前登录状态无效，无法发送日程。')
  })
})
