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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_feedback: {
        Row: {
          agent: string
          context: Json | null
          created_at: string
          id: string
          message: string
          role: string
        }
        Insert: {
          agent: string
          context?: Json | null
          created_at?: string
          id?: string
          message: string
          role: string
        }
        Update: {
          agent?: string
          context?: Json | null
          created_at?: string
          id?: string
          message?: string
          role?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          ranked: number
          scanned: number
          source: string
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          ranked?: number
          scanned?: number
          source?: string
          started_at?: string
          status?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          ranked?: number
          scanned?: number
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      journal_entries: {
        Row: {
          closed_at: string | null
          current_price: number | null
          entry_price: number
          id: string
          kind: string
          last_checked_at: string | null
          name: string | null
          peak_price: number | null
          recommendation_id: string | null
          sector: string | null
          status: string
          suggested_at: string
          swing_score: number | null
          symbol: string
          tags: string[] | null
          target_price: number | null
        }
        Insert: {
          closed_at?: string | null
          current_price?: number | null
          entry_price: number
          id?: string
          kind?: string
          last_checked_at?: string | null
          name?: string | null
          peak_price?: number | null
          recommendation_id?: string | null
          sector?: string | null
          status?: string
          suggested_at?: string
          swing_score?: number | null
          symbol: string
          tags?: string[] | null
          target_price?: number | null
        }
        Update: {
          closed_at?: string | null
          current_price?: number | null
          entry_price?: number
          id?: string
          kind?: string
          last_checked_at?: string | null
          name?: string | null
          peak_price?: number | null
          recommendation_id?: string | null
          sector?: string | null
          status?: string
          suggested_at?: string
          swing_score?: number | null
          symbol?: string
          tags?: string[] | null
          target_price?: number | null
        }
        Relationships: []
      }
      price_cache: {
        Row: {
          payload: Json
          symbol: string
          updated_at: string
        }
        Insert: {
          payload: Json
          symbol: string
          updated_at?: string
        }
        Update: {
          payload?: Json
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      rankings: {
        Row: {
          change_pct: number | null
          created_at: string
          fundamental_score: number
          history_score: number
          id: string
          ltp: number | null
          macro_score: number
          monthly_score: number
          name: string | null
          reasoning: Json | null
          rs_score: number
          run_id: string | null
          sector: string | null
          sector_score: number
          status: string
          swing_score: number
          symbol: string
          volume_score: number
          weekly_score: number
        }
        Insert: {
          change_pct?: number | null
          created_at?: string
          fundamental_score?: number
          history_score?: number
          id?: string
          ltp?: number | null
          macro_score?: number
          monthly_score?: number
          name?: string | null
          reasoning?: Json | null
          rs_score?: number
          run_id?: string | null
          sector?: string | null
          sector_score?: number
          status?: string
          swing_score?: number
          symbol: string
          volume_score?: number
          weekly_score?: number
        }
        Update: {
          change_pct?: number | null
          created_at?: string
          fundamental_score?: number
          history_score?: number
          id?: string
          ltp?: number | null
          macro_score?: number
          monthly_score?: number
          name?: string | null
          reasoning?: Json | null
          rs_score?: number
          run_id?: string | null
          sector?: string | null
          sector_score?: number
          status?: string
          swing_score?: number
          symbol?: string
          volume_score?: number
          weekly_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "rankings_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          archived_at: string | null
          entry_price: number | null
          expires_at: string
          history_score: number
          id: string
          ltp: number | null
          monthly_score: number
          name: string | null
          outcome: string | null
          reasoning: Json | null
          recommended_at: string
          removed_image_path: string | null
          removed_reason: string | null
          rs_score: number
          sector: string | null
          status: string
          swing_score: number
          symbol: string
          tags: string[] | null
          volume_score: number
          weekly_score: number
        }
        Insert: {
          archived_at?: string | null
          entry_price?: number | null
          expires_at?: string
          history_score?: number
          id?: string
          ltp?: number | null
          monthly_score?: number
          name?: string | null
          outcome?: string | null
          reasoning?: Json | null
          recommended_at?: string
          removed_image_path?: string | null
          removed_reason?: string | null
          rs_score?: number
          sector?: string | null
          status?: string
          swing_score?: number
          symbol: string
          tags?: string[] | null
          volume_score?: number
          weekly_score?: number
        }
        Update: {
          archived_at?: string | null
          entry_price?: number | null
          expires_at?: string
          history_score?: number
          id?: string
          ltp?: number | null
          monthly_score?: number
          name?: string | null
          outcome?: string | null
          reasoning?: Json | null
          recommended_at?: string
          removed_image_path?: string | null
          removed_reason?: string | null
          rs_score?: number
          sector?: string | null
          status?: string
          swing_score?: number
          symbol?: string
          tags?: string[] | null
          volume_score?: number
          weekly_score?: number
        }
        Relationships: []
      }
      stock_universe: {
        Row: {
          active: boolean
          created_at: string
          exchange: string
          id: string
          kind: string
          name: string
          sector: string
          symbol: string
          yahoo_symbol: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          exchange?: string
          id?: string
          kind?: string
          name: string
          sector: string
          symbol: string
          yahoo_symbol: string
        }
        Update: {
          active?: boolean
          created_at?: string
          exchange?: string
          id?: string
          kind?: string
          name?: string
          sector?: string
          symbol?: string
          yahoo_symbol?: string
        }
        Relationships: []
      }
      training_examples: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          image_path: string
          label: string
          note: string | null
          sector: string | null
          symbol: string | null
          tags: string[] | null
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          image_path: string
          label?: string
          note?: string | null
          sector?: string | null
          symbol?: string | null
          tags?: string[] | null
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          image_path?: string
          label?: string
          note?: string | null
          sector?: string | null
          symbol?: string | null
          tags?: string[] | null
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
