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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_updates: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          title: string
          update_type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          title: string
          update_type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          title?: string
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_assessments: {
        Row: {
          confidence: number | null
          created_at: string
          evidence_basis: string
          explanation: string
          id: string
          input_evidence: Json
          model_version: string
          observed_evidence: string | null
          recommendation: string
          reference_example_ids: string[]
          run_id: string
          speculation: string | null
          updated_at: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          evidence_basis: string
          explanation: string
          id?: string
          input_evidence?: Json
          model_version: string
          observed_evidence?: string | null
          recommendation: string
          reference_example_ids?: string[]
          run_id: string
          speculation?: string | null
          updated_at?: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          evidence_basis?: string
          explanation?: string
          id?: string
          input_evidence?: Json
          model_version?: string
          observed_evidence?: string | null
          recommendation?: string
          reference_example_ids?: string[]
          run_id?: string
          speculation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_assessments_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          run_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          run_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_history_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          game_id: string
          id: string
          name: string
          parent_category_id: string | null
          sort_order: number
          timing_rules: string | null
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          name: string
          parent_category_id?: string | null
          sort_order?: number
          timing_rules?: string | null
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          name?: string
          parent_category_id?: string | null
          sort_order?: number
          timing_rules?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_same_game_fkey"
            columns: ["parent_category_id", "game_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      game_requests: {
        Row: {
          created_at: string
          game_name: string
          game_url: string
          id: string
          requester_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          game_name: string
          game_url: string
          id?: string
          requester_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          game_name?: string
          game_url?: string
          id?: string
          requester_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rules: {
        Row: {
          category_id: string | null
          created_at: string
          game_id: string
          id: string
          rule_text: string
          sort_order: number
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          game_id: string
          id?: string
          rule_text: string
          sort_order?: number
        }
        Update: {
          category_id?: string | null
          created_at?: string
          game_id?: string
          id?: string
          rule_text?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_rules_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          blurb: string | null
          cover_url: string | null
          created_at: string
          id: string
          is_featured: boolean
          is_hidden: boolean
          page_url: string | null
          slug: string
          source: string | null
          title: string
        }
        Insert: {
          blurb?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          page_url?: string | null
          slug: string
          source?: string | null
          title: string
        }
        Update: {
          blurb?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          is_featured?: boolean
          is_hidden?: boolean
          page_url?: string | null
          slug?: string
          source?: string | null
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          id: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      reference_examples: {
        Row: {
          category_id: string
          created_at: string
          game_id: string
          id: string
          label: string
          marked_by: string
          notes: string | null
          run_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          game_id: string
          id?: string
          label: string
          marked_by: string
          notes?: string | null
          run_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          game_id?: string
          id?: string
          label?: string
          marked_by?: string
          notes?: string | null
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reference_examples_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_examples_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_examples_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reference_examples_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: true
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      reserved_usernames: {
        Row: {
          name: string
        }
        Insert: {
          name: string
        }
        Update: {
          name?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          category_id: string
          created_at: string
          game_id: string
          id: string
          notes: string | null
          platform: string
          rejection_reason: string | null
          runner_id: string
          status: string
          time_ms: number
          verified_at: string | null
          verified_by: string | null
          video_end_seconds: number | null
          video_id: string | null
          video_start_seconds: number | null
          video_url: string
        }
        Insert: {
          category_id: string
          created_at?: string
          game_id: string
          id?: string
          notes?: string | null
          platform?: string
          rejection_reason?: string | null
          runner_id?: string
          status?: string
          time_ms: number
          verified_at?: string | null
          verified_by?: string | null
          video_end_seconds?: number | null
          video_id?: string | null
          video_start_seconds?: number | null
          video_url: string
        }
        Update: {
          category_id?: string
          created_at?: string
          game_id?: string
          id?: string
          notes?: string | null
          platform?: string
          rejection_reason?: string | null
          runner_id?: string
          status?: string
          time_ms?: number
          verified_at?: string | null
          verified_by?: string | null
          video_end_seconds?: number | null
          video_id?: string | null
          video_start_seconds?: number | null
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "runs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_username_available: {
        Args: { p_username: string }
        Returns: string
      }
      delete_run: { Args: { p_run: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_game_staff: { Args: never; Returns: boolean }
      is_game_under_construction: { Args: { p_slug: string }; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      record_assessment: {
        Args: {
          p_confidence: number
          p_evidence_basis: string
          p_explanation: string
          p_input_evidence: Json
          p_model_version: string
          p_observed_evidence: string
          p_recommendation: string
          p_reference_example_ids: string[]
          p_run_id: string
          p_speculation: string
        }
        Returns: string
      }
      reject_run: {
        Args: { p_reason: string; p_run: string }
        Returns: undefined
      }
      reorder_categories: {
        Args: { p_category_ids: string[]; p_game_id: string }
        Returns: undefined
      }
      set_member_role: {
        Args: { p_member: string; p_role: string }
        Returns: undefined
      }
      verify_run: { Args: { p_run: string }; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "member" | "moderator"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "member", "moderator"],
    },
  },
} as const
