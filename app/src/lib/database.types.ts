export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          absent_days: number | null
          actual_days: number | null
          created_at: string | null
          department_id: string
          early_leave_times: number | null
          expected_days: number | null
          id: string
          late_times: number | null
          leave_days: number | null
          member_id: string
          updated_at: string | null
          year_month: number
        }
        Insert: {
          absent_days?: number | null
          actual_days?: number | null
          created_at?: string | null
          department_id: string
          early_leave_times?: number | null
          expected_days?: number | null
          id?: string
          late_times?: number | null
          leave_days?: number | null
          member_id: string
          updated_at?: string | null
          year_month: number
        }
        Update: {
          absent_days?: number | null
          actual_days?: number | null
          created_at?: string | null
          department_id?: string
          early_leave_times?: number | null
          expected_days?: number | null
          id?: string
          late_times?: number | null
          leave_days?: number | null
          member_id?: string
          updated_at?: string | null
          year_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "feishu_departments"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "attendance_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "feishu_members"
            referencedColumns: ["id"]
          },
        ]
      }
      business_trips: {
        Row: {
          customer_name: string | null
          department: string | null
          employee_id: string | null
          employee_name: string | null
          end_time: string | null
          id: number
          opportunity_name: string | null
          reason: string | null
          start_time: string | null
        }
        Insert: {
          customer_name?: string | null
          department?: string | null
          employee_id?: string | null
          employee_name?: string | null
          end_time?: string | null
          id?: number
          opportunity_name?: string | null
          reason?: string | null
          start_time?: string | null
        }
        Update: {
          customer_name?: string | null
          department?: string | null
          employee_id?: string | null
          employee_name?: string | null
          end_time?: string | null
          id?: number
          opportunity_name?: string | null
          reason?: string | null
          start_time?: string | null
        }
        Relationships: []
      }
      feishu_departments: {
        Row: {
          created_at: string | null
          department_id: string
          id: string
          leader_user_id: string | null
          member_count: number | null
          name: string
          order_value: number | null
          parent_id: string | null
          status: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          department_id: string
          id?: string
          leader_user_id?: string | null
          member_count?: number | null
          name: string
          order_value?: number | null
          parent_id?: string | null
          status?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          department_id?: string
          id?: string
          leader_user_id?: string | null
          member_count?: number | null
          name?: string
          order_value?: number | null
          parent_id?: string | null
          status?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      feishu_members: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department_id: string | null
          email: string | null
          employee_no: string | null
          employee_type: number | null
          en_name: string | null
          gender: number | null
          id: string
          job_title: string | null
          join_time: number | null
          name: string
          open_id: string
          status: Json | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department_id?: string | null
          email?: string | null
          employee_no?: string | null
          employee_type?: number | null
          en_name?: string | null
          gender?: number | null
          id?: string
          job_title?: string | null
          join_time?: number | null
          name: string
          open_id: string
          status?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department_id?: string | null
          email?: string | null
          employee_no?: string | null
          employee_type?: number | null
          en_name?: string | null
          gender?: number | null
          id?: string
          job_title?: string | null
          join_time?: number | null
          name?: string
          open_id?: string
          status?: Json | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      opportunity_ledger: {
        Row: {
          id: string
          snapshot_id: string
          snapshot_date: string
          sheet_name: string
          row_number: number
          schema_version: string
          project_group: string | null
          project_name: string
          stage_code: string
          stage_label: string
          progress_note: string | null
          target_date: string | null
          target_date_raw: string | null
          first_year_revenue: number | null
          first_year_revenue_raw: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          snapshot_id: string
          snapshot_date: string
          sheet_name: string
          row_number: number
          schema_version: string
          project_group?: string | null
          project_name: string
          stage_code: string
          stage_label: string
          progress_note?: string | null
          target_date?: string | null
          target_date_raw?: string | null
          first_year_revenue?: number | null
          first_year_revenue_raw?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          snapshot_id?: string
          snapshot_date?: string
          sheet_name?: string
          row_number?: number
          schema_version?: string
          project_group?: string | null
          project_name?: string
          stage_code?: string
          stage_label?: string
          progress_note?: string | null
          target_date?: string | null
          target_date_raw?: string | null
          first_year_revenue?: number | null
          first_year_revenue_raw?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedule_items: {
        Row: {
          created_at: string | null
          date: string | null
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          meeting_notes: string | null
          period: string | null
          start_time: string | null
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_notes?: string | null
          period?: string | null
          start_time?: string | null
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          meeting_notes?: string | null
          period?: string | null
          start_time?: string | null
          title?: string
          type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
