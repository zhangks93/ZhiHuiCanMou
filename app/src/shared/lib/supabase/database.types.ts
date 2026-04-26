export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          feishu_open_id: string | null
          name: string | null
          avatar_url: string | null
          org_id: string | null
          org_node_id: string | null
          reports_to_id: string | null
          role: 'president' | 'director' | 'manager' | 'supervisor' | null
          updated_at: string
        }
        Insert: {
          id: string
          feishu_open_id?: string | null
          name?: string | null
          avatar_url?: string | null
          org_id?: string | null
          org_node_id?: string | null
          reports_to_id?: string | null
          role?: 'president' | 'director' | 'manager' | 'supervisor' | null
          updated_at?: string
        }
        Update: {
          feishu_open_id?: string | null
          name?: string | null
          avatar_url?: string | null
          org_id?: string | null
          org_node_id?: string | null
          reports_to_id?: string | null
          role?: 'president' | 'director' | 'manager' | 'supervisor' | null
          updated_at?: string
        }
        Relationships: []
      }
      schedule_transfers: {
        Row: {
          id: string
          sender_user_id: string
          recipient_user_id: string
          status: 'pending' | 'imported' | 'cancelled'
          payload_json: Json
          payload_hash: string
          imported_summary: Json | null
          created_at: string
          imported_at: string | null
          cancelled_at: string | null
        }
        Insert: {
          id?: string
          sender_user_id: string
          recipient_user_id: string
          status?: 'pending' | 'imported' | 'cancelled'
          payload_json: Json
          payload_hash: string
          imported_summary?: Json | null
          created_at?: string
          imported_at?: string | null
          cancelled_at?: string | null
        }
        Update: {
          status?: 'pending' | 'imported' | 'cancelled'
          imported_summary?: Json | null
          imported_at?: string | null
          cancelled_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
