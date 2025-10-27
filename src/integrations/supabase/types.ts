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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      agent_config: {
        Row: {
          created_at: string
          first_message: string | null
          id: string
          is_active: boolean | null
          max_tokens: number | null
          name: string
          system_prompt: string
          temperature: number | null
          updated_at: string
          user_id: string
          voice_id: string | null
          voice_similarity: number | null
          voice_stability: number | null
          voice_style: number | null
        }
        Insert: {
          created_at?: string
          first_message?: string | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          name: string
          system_prompt: string
          temperature?: number | null
          updated_at?: string
          user_id: string
          voice_id?: string | null
          voice_similarity?: number | null
          voice_stability?: number | null
          voice_style?: number | null
        }
        Update: {
          created_at?: string
          first_message?: string | null
          id?: string
          is_active?: boolean | null
          max_tokens?: number | null
          name?: string
          system_prompt?: string
          temperature?: number | null
          updated_at?: string
          user_id?: string
          voice_id?: string | null
          voice_similarity?: number | null
          voice_stability?: number | null
          voice_style?: number | null
        }
        Relationships: []
      }
      analytics: {
        Row: {
          avg_satisfaction: number | null
          created_at: string
          date: string
          id: string
          platform: string | null
          total_conversations: number | null
          total_duration: number | null
          user_id: string
        }
        Insert: {
          avg_satisfaction?: number | null
          created_at?: string
          date: string
          id?: string
          platform?: string | null
          total_conversations?: number | null
          total_duration?: number | null
          user_id: string
        }
        Update: {
          avg_satisfaction?: number | null
          created_at?: string
          date?: string
          id?: string
          platform?: string | null
          total_conversations?: number | null
          total_duration?: number | null
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          agent_messages: Json | null
          audio_url: string | null
          created_at: string
          duration: number | null
          external_id: string | null
          id: string
          keywords: string[] | null
          metadata: Json | null
          platform: string | null
          satisfaction_score: number | null
          sentiment: string | null
          status: string | null
          title: string
          transcript: string | null
          user_id: string
          user_messages: Json | null
        }
        Insert: {
          agent_messages?: Json | null
          audio_url?: string | null
          created_at?: string
          duration?: number | null
          external_id?: string | null
          id?: string
          keywords?: string[] | null
          metadata?: Json | null
          platform?: string | null
          satisfaction_score?: number | null
          sentiment?: string | null
          status?: string | null
          title: string
          transcript?: string | null
          user_id: string
          user_messages?: Json | null
        }
        Update: {
          agent_messages?: Json | null
          audio_url?: string | null
          created_at?: string
          duration?: number | null
          external_id?: string | null
          id?: string
          keywords?: string[] | null
          metadata?: Json | null
          platform?: string | null
          satisfaction_score?: number | null
          sentiment?: string | null
          status?: string | null
          title?: string
          transcript?: string | null
          user_id?: string
          user_messages?: Json | null
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          synced_to_elevenlabs: boolean | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          synced_to_elevenlabs?: boolean | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          synced_to_elevenlabs?: boolean | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      knowledge_base_items: {
        Row: {
          category: string
          content: string
          created_at: string | null
          elevenlabs_id: string | null
          id: string
          is_synced: boolean | null
          last_synced_at: string | null
          search_vector: unknown
          tags: string[] | null
          title: string
          updated_at: string | null
          usage_count: number | null
          user_id: string
        }
        Insert: {
          category?: string
          content: string
          created_at?: string | null
          elevenlabs_id?: string | null
          id?: string
          is_synced?: boolean | null
          last_synced_at?: string | null
          search_vector?: unknown
          tags?: string[] | null
          title: string
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          elevenlabs_id?: string | null
          id?: string
          is_synced?: boolean | null
          last_synced_at?: string | null
          search_vector?: unknown
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      organization_integrations: {
        Row: {
          additional_config: Json | null
          agent_id: string | null
          api_key: string
          created_at: string
          id: string
          is_active: boolean | null
          last_tested_at: string | null
          platform: string
          test_error: string | null
          test_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_config?: Json | null
          agent_id?: string | null
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_tested_at?: string | null
          platform: string
          test_error?: string | null
          test_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_config?: Json | null
          agent_id?: string | null
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_tested_at?: string | null
          platform?: string
          test_error?: string | null
          test_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
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
