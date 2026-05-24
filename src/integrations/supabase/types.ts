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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          carry_forward_fees: number
          created_at: string | null
          end_date: string
          id: string
          label: string
          start_date: string
          status: string
          target_tuition_fees: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          carry_forward_fees?: number
          created_at?: string | null
          end_date: string
          id?: string
          label: string
          start_date: string
          status?: string
          target_tuition_fees?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          carry_forward_fees?: number
          created_at?: string | null
          end_date?: string
          id?: string
          label?: string
          start_date?: string
          status?: string
          target_tuition_fees?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          created_at: string | null
          id: string
          is_archived: boolean | null
          name: string
          starting_balance: number
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          starting_balance?: number
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          starting_balance?: number
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      backups_log: {
        Row: {
          backup_date: string | null
          backup_type: string
          file_size: number | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          backup_date?: string | null
          backup_type: string
          file_size?: number | null
          id?: string
          status: string
          user_id: string
        }
        Update: {
          backup_date?: string | null
          backup_type?: string
          file_size?: number | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      expense_entries: {
        Row: {
          academic_year_id: string
          account_id: string
          amount: number
          category: string
          created_at: string | null
          date: string
          description: string | null
          expense_type: string
          id: string
          is_recurring_instance: boolean | null
          recurring_template_id: string | null
          sub_category: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          academic_year_id: string
          account_id: string
          amount: number
          category: string
          created_at?: string | null
          date: string
          description?: string | null
          expense_type: string
          id?: string
          is_recurring_instance?: boolean | null
          recurring_template_id?: string | null
          sub_category?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          academic_year_id?: string
          account_id?: string
          amount?: number
          category?: string
          created_at?: string | null
          date?: string
          description?: string | null
          expense_type?: string
          id?: string
          is_recurring_instance?: boolean | null
          recurring_template_id?: string | null
          sub_category?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_entries_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      income_entries: {
        Row: {
          academic_year_id: string
          account_id: string
          amount: number
          created_at: string | null
          date: string
          id: string
          is_late_collection: boolean | null
          notes: string | null
          original_year_id: string | null
          tags: string[] | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          academic_year_id: string
          account_id: string
          amount: number
          created_at?: string | null
          date: string
          id?: string
          is_late_collection?: boolean | null
          notes?: string | null
          original_year_id?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          academic_year_id?: string
          account_id?: string
          amount?: number
          created_at?: string | null
          date?: string
          id?: string
          is_late_collection?: boolean | null
          notes?: string | null
          original_year_id?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_entries_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_entries_original_year_id_fkey"
            columns: ["original_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_templates: {
        Row: {
          category: string
          created_at: string | null
          default_amount: number | null
          expense_type: string
          id: string
          is_active: boolean | null
          last_generated_date: string | null
          recurrence_interval: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string | null
          default_amount?: number | null
          expense_type: string
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          recurrence_interval: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          default_amount?: number | null
          expense_type?: string
          id?: string
          is_active?: boolean | null
          last_generated_date?: string | null
          recurrence_interval?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          date: string
          from_account_id: string
          id: string
          notes: string | null
          to_account_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          date: string
          from_account_id: string
          id?: string
          notes?: string | null
          to_account_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          date?: string
          from_account_id?: string
          id?: string
          notes?: string | null
          to_account_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
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
