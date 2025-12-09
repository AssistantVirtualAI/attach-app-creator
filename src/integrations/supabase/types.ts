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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          system_prompt?: string
          temperature?: number | null
          updated_at?: string
          user_id?: string
          voice_id?: string | null
          voice_similarity?: number | null
          voice_stability?: number | null
          voice_style?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          branding_url: string | null
          client_id: string | null
          config: Json | null
          created_at: string
          description: string | null
          id: string
          is_external: boolean | null
          name: string
          organization_id: string
          platform: string
          platform_agent_id: string | null
          platform_api_key: string | null
          theme_config: Json | null
          updated_at: string
          widget_layout: string | null
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          branding_url?: string | null
          client_id?: string | null
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_external?: boolean | null
          name: string
          organization_id: string
          platform: string
          platform_agent_id?: string | null
          platform_api_key?: string | null
          theme_config?: Json | null
          updated_at?: string
          widget_layout?: string | null
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          branding_url?: string | null
          client_id?: string | null
          config?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          is_external?: boolean | null
          name?: string
          organization_id?: string
          platform?: string
          platform_agent_id?: string | null
          platform_api_key?: string | null
          theme_config?: Json | null
          updated_at?: string
          widget_layout?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics: {
        Row: {
          avg_satisfaction: number | null
          created_at: string
          date: string
          id: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          platform?: string | null
          total_conversations?: number | null
          total_duration?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          organization_id: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          organization_id?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_config: {
        Row: {
          ai_credits: number | null
          created_at: string
          credits_limit: number | null
          credits_used: number | null
          organization_id: string
          plan_tier: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_ends_at: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          ai_credits?: number | null
          created_at?: string
          credits_limit?: number | null
          credits_used?: number | null
          organization_id: string
          plan_tier?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_credits?: number | null
          created_at?: string
          credits_limit?: number | null
          credits_used?: number | null
          organization_id?: string
          plan_tier?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_ends_at?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_calls: {
        Row: {
          called_at: string | null
          campaign_id: string
          created_at: string
          duration: number | null
          id: string
          metadata: Json | null
          outcome: string | null
          phone_number: string
          status: string
          transcript: string | null
        }
        Insert: {
          called_at?: string | null
          campaign_id: string
          created_at?: string
          duration?: number | null
          id?: string
          metadata?: Json | null
          outcome?: string | null
          phone_number: string
          status?: string
          transcript?: string | null
        }
        Update: {
          called_at?: string | null
          campaign_id?: string
          created_at?: string
          duration?: number | null
          id?: string
          metadata?: Json | null
          outcome?: string | null
          phone_number?: string
          status?: string
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_calls_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "outbound_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members: {
        Row: {
          client_id: string
          created_at: string | null
          email: string
          id: string
          name: string | null
          role: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          role?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          access_controls: Json | null
          assigned_agent_id: string | null
          assigned_agents: number | null
          created_at: string
          created_by: string | null
          custom_css: string | null
          email: string | null
          id: string
          language: string | null
          login_id: string | null
          name: string
          organization_id: string
          status: string | null
          theme: string | null
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          access_controls?: Json | null
          assigned_agent_id?: string | null
          assigned_agents?: number | null
          created_at?: string
          created_by?: string | null
          custom_css?: string | null
          email?: string | null
          id?: string
          language?: string | null
          login_id?: string | null
          name: string
          organization_id: string
          status?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          access_controls?: Json | null
          assigned_agent_id?: string | null
          assigned_agents?: number | null
          created_at?: string
          created_by?: string | null
          custom_css?: string | null
          email?: string | null
          id?: string
          language?: string | null
          login_id?: string | null
          name?: string
          organization_id?: string
          status?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_topics: {
        Row: {
          analyzed_at: string
          category: string | null
          confidence: number | null
          conversation_id: string | null
          created_at: string
          frequency: number | null
          id: string
          organization_id: string
          sentiment: string | null
          topic: string
        }
        Insert: {
          analyzed_at?: string
          category?: string | null
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          frequency?: number | null
          id?: string
          organization_id: string
          sentiment?: string | null
          topic: string
        }
        Update: {
          analyzed_at?: string
          category?: string | null
          confidence?: number | null
          conversation_id?: string | null
          created_at?: string
          frequency?: number | null
          id?: string
          organization_id?: string
          sentiment?: string | null
          topic?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_topics_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_topics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          agent_id: string | null
          agent_messages: Json | null
          audio_url: string | null
          client_id: string | null
          created_at: string
          default_label: string | null
          duration: number | null
          external_id: string | null
          id: string
          keywords: string[] | null
          label_variable: string | null
          metadata: Json | null
          organization_id: string | null
          platform: string | null
          resolution_status: string | null
          satisfaction_score: number | null
          sentiment: string | null
          status: string | null
          title: string
          transcript: string | null
          user_id: string
          user_messages: Json | null
        }
        Insert: {
          agent_id?: string | null
          agent_messages?: Json | null
          audio_url?: string | null
          client_id?: string | null
          created_at?: string
          default_label?: string | null
          duration?: number | null
          external_id?: string | null
          id?: string
          keywords?: string[] | null
          label_variable?: string | null
          metadata?: Json | null
          organization_id?: string | null
          platform?: string | null
          resolution_status?: string | null
          satisfaction_score?: number | null
          sentiment?: string | null
          status?: string | null
          title: string
          transcript?: string | null
          user_id: string
          user_messages?: Json | null
        }
        Update: {
          agent_id?: string | null
          agent_messages?: Json | null
          audio_url?: string | null
          client_id?: string | null
          created_at?: string
          default_label?: string | null
          duration?: number | null
          external_id?: string | null
          id?: string
          keywords?: string[] | null
          label_variable?: string | null
          metadata?: Json | null
          organization_id?: string | null
          platform?: string | null
          resolution_status?: string | null
          satisfaction_score?: number | null
          sentiment?: string | null
          status?: string | null
          title?: string
          transcript?: string | null
          user_id?: string
          user_messages?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body: string | null
          created_at: string | null
          greeting: string | null
          id: string
          organization_id: string
          subject: string | null
          template_type: string
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          greeting?: string | null
          id?: string
          organization_id: string
          subject?: string | null
          template_type: string
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          greeting?: string | null
          id?: string
          organization_id?: string
          subject?: string | null
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          search_vector?: unknown
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          scopes: string[] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          scopes?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          scopes?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          platform?: string
          test_error?: string | null
          test_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          invited_by: string | null
          organization_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          organization_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          invited_by?: string | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          api_key: string | null
          baa_signed_at: string | null
          baa_signed_by: string | null
          backend_domain: string | null
          client_limit: number | null
          created_at: string
          domain: string | null
          email_domain: string | null
          email_logo_url: string | null
          email_sender: string | null
          email_sender_name: string | null
          favicon_url: string | null
          gdpr_enabled: boolean | null
          hipaa_enabled: boolean | null
          id: string
          is_active: boolean | null
          loading_icon: string | null
          loading_icon_size: string | null
          logo_dashboard_url: string | null
          logo_login_url: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean | null
          primary_color: string | null
          privacy_policy_url: string | null
          slug: string
          terms_url: string | null
          updated_at: string
          website_title: string | null
        }
        Insert: {
          api_key?: string | null
          baa_signed_at?: string | null
          baa_signed_by?: string | null
          backend_domain?: string | null
          client_limit?: number | null
          created_at?: string
          domain?: string | null
          email_domain?: string | null
          email_logo_url?: string | null
          email_sender?: string | null
          email_sender_name?: string | null
          favicon_url?: string | null
          gdpr_enabled?: boolean | null
          hipaa_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          loading_icon?: string | null
          loading_icon_size?: string | null
          logo_dashboard_url?: string | null
          logo_login_url?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean | null
          primary_color?: string | null
          privacy_policy_url?: string | null
          slug: string
          terms_url?: string | null
          updated_at?: string
          website_title?: string | null
        }
        Update: {
          api_key?: string | null
          baa_signed_at?: string | null
          baa_signed_by?: string | null
          backend_domain?: string | null
          client_limit?: number | null
          created_at?: string
          domain?: string | null
          email_domain?: string | null
          email_logo_url?: string | null
          email_sender?: string | null
          email_sender_name?: string | null
          favicon_url?: string | null
          gdpr_enabled?: boolean | null
          hipaa_enabled?: boolean | null
          id?: string
          is_active?: boolean | null
          loading_icon?: string | null
          loading_icon_size?: string | null
          logo_dashboard_url?: string | null
          logo_login_url?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean | null
          primary_color?: string | null
          privacy_policy_url?: string | null
          slug?: string
          terms_url?: string | null
          updated_at?: string
          website_title?: string | null
        }
        Relationships: []
      }
      outbound_campaigns: {
        Row: {
          agent_id: string | null
          completed_at: string | null
          completed_calls: number | null
          created_at: string
          description: string | null
          failed_calls: number | null
          id: string
          name: string
          organization_id: string
          phone_numbers: Json
          schedule: Json | null
          started_at: string | null
          status: string
          successful_calls: number | null
          total_calls: number | null
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          completed_at?: string | null
          completed_calls?: number | null
          created_at?: string
          description?: string | null
          failed_calls?: number | null
          id?: string
          name: string
          organization_id: string
          phone_numbers?: Json
          schedule?: Json | null
          started_at?: string | null
          status?: string
          successful_calls?: number | null
          total_calls?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          completed_at?: string | null
          completed_calls?: number | null
          created_at?: string
          description?: string | null
          failed_calls?: number | null
          id?: string
          name?: string
          organization_id?: string
          phone_numbers?: Json
          schedule?: Json | null
          started_at?: string | null
          status?: string
          successful_calls?: number | null
          total_calls?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          deletion_requested_at: string | null
          email: string
          full_name: string | null
          id: string
          locale: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_requested_at?: string | null
          email: string
          full_name?: string | null
          id: string
          locale?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          deletion_requested_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          locale?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      topic_aggregates: {
        Row: {
          avg_sentiment: number | null
          category: string | null
          created_at: string
          id: string
          last_mentioned_at: string
          organization_id: string
          topic: string
          total_mentions: number | null
          updated_at: string
        }
        Insert: {
          avg_sentiment?: number | null
          category?: string | null
          created_at?: string
          id?: string
          last_mentioned_at?: string
          organization_id: string
          topic: string
          total_mentions?: number | null
          updated_at?: string
        }
        Update: {
          avg_sentiment?: number | null
          category?: string | null
          created_at?: string
          id?: string
          last_mentioned_at?: string
          organization_id?: string
          topic?: string
          total_mentions?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_aggregates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          consent_type: string
          consented: boolean | null
          created_at: string | null
          id: string
          ip_address: string | null
          organization_id: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          consent_type: string
          consented?: boolean | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          consent_type?: string
          consented?: boolean | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_consents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_delivery_logs: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          delivered_at: string | null
          endpoint_id: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          endpoint_id?: string | null
          event_type: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          endpoint_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_logs_endpoint_id_fkey"
            columns: ["endpoint_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string | null
          events: string[] | null
          id: string
          is_active: boolean | null
          organization_id: string | null
          secret: string
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          secret: string
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          events?: string[] | null
          id?: string
          is_active?: boolean | null
          organization_id?: string | null
          secret?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          connector: string
          created_at: string
          event_type: string
          id: string
          organization_id: string
          payload: Json
          processed: boolean | null
          signature: string | null
        }
        Insert: {
          connector: string
          created_at?: string
          event_type: string
          id?: string
          organization_id: string
          payload?: Json
          processed?: boolean | null
          signature?: string | null
        }
        Update: {
          connector?: string
          created_at?: string
          event_type?: string
          id?: string
          organization_id?: string
          payload?: Json
          processed?: boolean | null
          signature?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflows: {
        Row: {
          app_name: string
          config: Json | null
          id: string
          installed_at: string | null
          is_active: boolean | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          app_name: string
          config?: Json | null
          id?: string
          installed_at?: string | null
          is_active?: boolean | null
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          app_name?: string
          config?: Json | null
          id?: string
          installed_at?: string | null
          is_active?: boolean | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_api_key: { Args: never; Returns: string }
      generate_unique_username: { Args: { base_name: string }; Returns: string }
      get_user_organization_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_role: {
        Args: { _org_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "org_admin" | "manager" | "agent" | "viewer"
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
    Enums: {
      app_role: ["super_admin", "org_admin", "manager", "agent", "viewer"],
    },
  },
} as const
