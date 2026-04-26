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
      edu_biz_monthly_plan: {
        Row: {
          created_at: string | null
          id: string
          metric_category: string
          metric_category_cn: string
          month: string
          node_name: string
          plan_value: number | null
          sort_order: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_category: string
          metric_category_cn: string
          month: string
          node_name: string
          plan_value?: number | null
          sort_order?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_category?: string
          metric_category_cn?: string
          month?: string
          node_name?: string
          plan_value?: number | null
          sort_order?: number
        }
        Relationships: []
      }
      edu_biz_report: {
        Row: {
          actual_value: number | null
          aggregation_level: string | null
          budget_value: number | null
          business_segment: string | null
          center_region: string | null
          completion_rate: number | null
          created_at: string | null
          diff_value: number | null
          id: string
          is_aggregated: boolean | null
          metric_category: string
          metric_category_cn: string
          node_name: string
          period: string
          period_type: string
          period_yoy: string | null
          report_level1: string | null
          report_level2: string | null
          report_type: string
          sheet_code: string
          sort_order: number
          yoy_value: number | null
        }
        Insert: {
          actual_value?: number | null
          aggregation_level?: string | null
          budget_value?: number | null
          business_segment?: string | null
          center_region?: string | null
          completion_rate?: number | null
          created_at?: string | null
          diff_value?: number | null
          id?: string
          is_aggregated?: boolean | null
          metric_category: string
          metric_category_cn: string
          node_name: string
          period: string
          period_type: string
          period_yoy?: string | null
          report_level1?: string | null
          report_level2?: string | null
          report_type: string
          sheet_code: string
          sort_order?: number
          yoy_value?: number | null
        }
        Update: {
          actual_value?: number | null
          aggregation_level?: string | null
          budget_value?: number | null
          business_segment?: string | null
          center_region?: string | null
          completion_rate?: number | null
          created_at?: string | null
          diff_value?: number | null
          id?: string
          is_aggregated?: boolean | null
          metric_category?: string
          metric_category_cn?: string
          node_name?: string
          period?: string
          period_type?: string
          period_yoy?: string | null
          report_level1?: string | null
          report_level2?: string | null
          report_type?: string
          sheet_code?: string
          sort_order?: number
          yoy_value?: number | null
        }
        Relationships: []
      }
      edu_org_hierarchy: {
        Row: {
          created_at: string | null
          id: string
          level_0: string | null
          level_1: string | null
          level_2: string | null
          node_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          level_0?: string | null
          level_1?: string | null
          level_2?: string | null
          node_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          level_0?: string | null
          level_1?: string | null
          level_2?: string | null
          node_name?: string
        }
        Relationships: []
      }
      edu_strategy_budget_plan: {
        Row: {
          business_line: string
          created_at: string | null
          id: string
          line_label: string
          line_role: string
          metric_code: string
          metric_name_cn: string
          plan_year: number
          sort_order: number
          source_note: string | null
          strategy_group: string
          strategy_group_cn: string
          unit: string
          value: number | null
          value_type: string
        }
        Insert: {
          business_line: string
          created_at?: string | null
          id?: string
          line_label: string
          line_role: string
          metric_code: string
          metric_name_cn: string
          plan_year: number
          sort_order?: number
          source_note?: string | null
          strategy_group: string
          strategy_group_cn: string
          unit: string
          value?: number | null
          value_type: string
        }
        Update: {
          business_line?: string
          created_at?: string | null
          id?: string
          line_label?: string
          line_role?: string
          metric_code?: string
          metric_name_cn?: string
          plan_year?: number
          sort_order?: number
          source_note?: string | null
          strategy_group?: string
          strategy_group_cn?: string
          unit?: string
          value?: number | null
          value_type?: string
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
      feishu_department_member_changes: {
        Row: {
          change_type: string
          current_member_count: number
          department_id: string
          department_name: string
          latest_snapshot_at: string | null
          member_count_change: number
          order_value: number
          parent_id: string | null
          previous_member_count: number
          previous_snapshot_at: string | null
        }
        Insert: {
          change_type: string
          current_member_count?: number
          department_id: string
          department_name: string
          latest_snapshot_at?: string | null
          member_count_change?: number
          order_value?: number
          parent_id?: string | null
          previous_member_count?: number
          previous_snapshot_at?: string | null
        }
        Update: {
          change_type?: string
          current_member_count?: number
          department_id?: string
          department_name?: string
          latest_snapshot_at?: string | null
          member_count_change?: number
          order_value?: number
          parent_id?: string | null
          previous_member_count?: number
          previous_snapshot_at?: string | null
        }
        Relationships: []
      }
      feishu_department_snapshots: {
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
          sync_run_id: string
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
          sync_run_id: string
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
          sync_run_id?: string
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
      feishu_member_snapshots: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department_id: string | null
          department_ids: string[] | null
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
          primary_department_id: string | null
          status: Json | null
          sync_run_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department_id?: string | null
          department_ids?: string[] | null
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
          primary_department_id?: string | null
          status?: Json | null
          sync_run_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department_id?: string | null
          department_ids?: string[] | null
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
          primary_department_id?: string | null
          status?: Json | null
          sync_run_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      feishu_sync_runs: {
        Row: {
          created_at: string | null
          department_count: number
          finished_at: string
          id: string
          last_snapshot_at: string | null
          member_count: number
          root_department_ids: string[] | null
          snapshot_at: string | null
          snapshot_reason: string | null
          snapshot_taken: boolean
          started_at: string
        }
        Insert: {
          created_at?: string | null
          department_count?: number
          finished_at: string
          id?: string
          last_snapshot_at?: string | null
          member_count?: number
          root_department_ids?: string[] | null
          snapshot_at?: string | null
          snapshot_reason?: string | null
          snapshot_taken?: boolean
          started_at: string
        }
        Update: {
          created_at?: string | null
          department_count?: number
          finished_at?: string
          id?: string
          last_snapshot_at?: string | null
          member_count?: number
          root_department_ids?: string[] | null
          snapshot_at?: string | null
          snapshot_reason?: string | null
          snapshot_taken?: boolean
          started_at?: string
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
      opportunity_ledger_v2: {
        Row: {
          acquisition_channel: string | null
          created_at: string
          expected_finish_date: string | null
          expected_finish_date_raw: string | null
          first_year_revenue: number | null
          first_year_revenue_raw: string | null
          id: string
          import_batch_id: string
          imported_at: string
          market_owner: string | null
          opportunity_attribute: string | null
          progress_note: string | null
          project_name: string
          referrer: string | null
          region: string | null
          row_number: number
          schema_version: string
          sheet_name: string
          snapshot_date: string
          source_file_name: string
          source_file_path: string | null
          stage_code: string
          stage_label: string
          updated_at: string
        }
        Insert: {
          acquisition_channel?: string | null
          created_at?: string
          expected_finish_date?: string | null
          expected_finish_date_raw?: string | null
          first_year_revenue?: number | null
          first_year_revenue_raw?: string | null
          id?: string
          import_batch_id: string
          imported_at?: string
          market_owner?: string | null
          opportunity_attribute?: string | null
          progress_note?: string | null
          project_name: string
          referrer?: string | null
          region?: string | null
          row_number: number
          schema_version?: string
          sheet_name: string
          snapshot_date: string
          source_file_name: string
          source_file_path?: string | null
          stage_code: string
          stage_label: string
          updated_at?: string
        }
        Update: {
          acquisition_channel?: string | null
          created_at?: string
          expected_finish_date?: string | null
          expected_finish_date_raw?: string | null
          first_year_revenue?: number | null
          first_year_revenue_raw?: string | null
          id?: string
          import_batch_id?: string
          imported_at?: string
          market_owner?: string | null
          opportunity_attribute?: string | null
          progress_note?: string | null
          project_name?: string
          referrer?: string | null
          region?: string | null
          row_number?: number
          schema_version?: string
          sheet_name?: string
          snapshot_date?: string
          source_file_name?: string
          source_file_path?: string | null
          stage_code?: string
          stage_label?: string
          updated_at?: string
        }
        Relationships: []
      }
      opportunity_snapshot_items: {
        Row: {
          acquisition_channel: string | null
          expected_finish_date: string | null
          first_year_revenue: number | null
          id: string
          market_owner: string | null
          opportunity_attribute: string | null
          progress_note: string | null
          project_name: string
          referrer: string | null
          region: string | null
          snapshot_date: string
          stage_label: string
        }
        Insert: {
          acquisition_channel?: string | null
          expected_finish_date?: string | null
          first_year_revenue?: number | null
          id?: string
          market_owner?: string | null
          opportunity_attribute?: string | null
          progress_note?: string | null
          project_name: string
          referrer?: string | null
          region?: string | null
          snapshot_date: string
          stage_label: string
        }
        Update: {
          acquisition_channel?: string | null
          expected_finish_date?: string | null
          first_year_revenue?: number | null
          id?: string
          market_owner?: string | null
          opportunity_attribute?: string | null
          progress_note?: string | null
          project_name?: string
          referrer?: string | null
          region?: string | null
          snapshot_date?: string
          stage_label?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          feishu_open_id: string | null
          id: string
          name: string | null
          org_id: string | null
          org_node_id: string | null
          reports_to_id: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          feishu_open_id?: string | null
          id: string
          name?: string | null
          org_id?: string | null
          org_node_id?: string | null
          reports_to_id?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          feishu_open_id?: string | null
          id?: string
          name?: string | null
          org_id?: string | null
          org_node_id?: string | null
          reports_to_id?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      schedule_transfers: {
        Row: {
          cancelled_at: string | null
          created_at: string
          id: string
          imported_at: string | null
          imported_summary: Json | null
          payload_hash: string
          payload_json: Json
          recipient_user_id: string
          sender_user_id: string
          status: 'pending' | 'imported' | 'cancelled'
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          imported_at?: string | null
          imported_summary?: Json | null
          payload_hash: string
          payload_json: Json
          recipient_user_id: string
          sender_user_id: string
          status?: 'pending' | 'imported' | 'cancelled'
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          id?: string
          imported_at?: string | null
          imported_summary?: Json | null
          payload_hash?: string
          payload_json?: Json
          recipient_user_id?: string
          sender_user_id?: string
          status?: 'pending' | 'imported' | 'cancelled'
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
