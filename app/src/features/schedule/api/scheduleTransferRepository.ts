import { supabase } from '@/shared/lib/supabase'
import type { Json, Tables } from '@/shared/lib/database.types'
import type {
  ScheduleImportResult,
  ScheduleTransferPayload,
} from './scheduleRepository'

export type ScheduleTransferStatus = 'pending' | 'imported' | 'cancelled'

export interface ScheduleTransferRecipient {
  userId: string
  name: string
  avatarUrl: string | null
  feishuOpenId: string | null
}

export interface ScheduleTransferRecord {
  id: string
  senderUserId: string
  recipientUserId: string
  status: ScheduleTransferStatus
  payload: ScheduleTransferPayload
  payloadHash: string
  importedSummary: ScheduleImportResult | null
  createdAt: string
  importedAt: string | null
  cancelledAt: string | null
  senderName: string
  recipientName: string
}

type RawTransferRow = Tables<'schedule_transfers'> & {
  payload_json: ScheduleTransferPayload
  imported_summary: ScheduleImportResult | null
}

type RawProfileRow = Tables<'profiles'>

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user?.id) {
    throw new Error('当前用户未登录，无法执行日程分享。')
  }
  return data.user.id
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}

function mapTransferRecord(
  row: RawTransferRow,
  profileById: Map<string, ScheduleTransferRecipient>,
): ScheduleTransferRecord {
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    recipientUserId: row.recipient_user_id,
    status: row.status,
    payload: row.payload_json,
    payloadHash: row.payload_hash,
    importedSummary: row.imported_summary,
    createdAt: row.created_at,
    importedAt: row.imported_at,
    cancelledAt: row.cancelled_at,
    senderName: profileById.get(row.sender_user_id)?.name ?? row.payload_json.sender.name,
    recipientName: profileById.get(row.recipient_user_id)?.name ?? '未知用户',
  }
}

async function fetchProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ScheduleTransferRecipient>()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, feishu_open_id')
    .in('id', userIds)

  if (error) throw error

  const profiles = new Map<string, ScheduleTransferRecipient>()
  for (const row of (data ?? []) as RawProfileRow[]) {
    profiles.set(row.id, {
      userId: row.id,
      name: row.name || '未命名用户',
      avatarUrl: row.avatar_url ?? null,
      feishuOpenId: row.feishu_open_id ?? null,
    })
  }
  return profiles
}

export async function listScheduleTransferRecipients() {
  const currentUserId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, avatar_url, feishu_open_id')
    .order('name', { ascending: true })

  if (error) throw error

  return ((data ?? []) as RawProfileRow[])
    .filter((row) => row.id !== currentUserId)
    .map((row) => ({
      userId: row.id,
      name: row.name || '未命名用户',
      avatarUrl: row.avatar_url ?? null,
      feishuOpenId: row.feishu_open_id ?? null,
    }))
}

export async function createScheduleTransfer(params: {
  recipientUserId: string
  payload: ScheduleTransferPayload
}) {
  const currentUserId = await getCurrentUserId()
  const payloadHash = await sha256Hex(JSON.stringify(params.payload))

  const { error } = await supabase.from('schedule_transfers').insert({
    sender_user_id: currentUserId,
    recipient_user_id: params.recipientUserId,
    status: 'pending',
    payload_json: params.payload as unknown as Json,
    payload_hash: payloadHash,
  })

  if (error) throw error
}

export async function listIncomingScheduleTransfers() {
  const currentUserId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('schedule_transfers')
    .select('*')
    .eq('recipient_user_id', currentUserId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as RawTransferRow[]
  const profileById = await fetchProfilesByIds(
    Array.from(new Set(rows.flatMap((row) => [row.sender_user_id, row.recipient_user_id]))),
  )

  return rows.map((row) => mapTransferRecord(row, profileById))
}

export async function listOutgoingScheduleTransfers() {
  const currentUserId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('schedule_transfers')
    .select('*')
    .eq('sender_user_id', currentUserId)
    .order('created_at', { ascending: false })

  if (error) throw error

  const rows = (data ?? []) as RawTransferRow[]
  const profileById = await fetchProfilesByIds(
    Array.from(new Set(rows.flatMap((row) => [row.sender_user_id, row.recipient_user_id]))),
  )

  return rows.map((row) => mapTransferRecord(row, profileById))
}

export async function markScheduleTransferImported(
  transferId: string,
  importResult: ScheduleImportResult,
) {
  const { error } = await supabase
    .from('schedule_transfers')
    .update({
      status: 'imported',
      imported_summary: importResult as unknown as Json,
      imported_at: new Date().toISOString(),
    })
    .eq('id', transferId)
    .eq('status', 'pending')

  if (error) throw error
}

export async function cancelScheduleTransfer(transferId: string) {
  const { error } = await supabase
    .from('schedule_transfers')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', transferId)
    .eq('status', 'pending')

  if (error) throw error
}
