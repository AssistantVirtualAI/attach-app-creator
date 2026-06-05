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
      agent_daily_reports: {
        Row: {
          agent_id: string | null
          avg_duration_seconds: number | null
          avg_satisfaction: number | null
          conversations_analyzed: number | null
          created_at: string | null
          generated_at: string | null
          id: string
          kb_suggestions: string[] | null
          language: string
          organization_id: string | null
          period_days: string
          period_end: string | null
          period_start: string | null
          priority_actions: Json | null
          prompt_suggestions: string[] | null
          recommendations: Json | null
          report_date: string
          strengths: Json | null
          success_rate: number | null
          summary: string | null
          total_conversations: number | null
          updated_at: string | null
          weaknesses: Json | null
        }
        Insert: {
          agent_id?: string | null
          avg_duration_seconds?: number | null
          avg_satisfaction?: number | null
          conversations_analyzed?: number | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          kb_suggestions?: string[] | null
          language?: string
          organization_id?: string | null
          period_days?: string
          period_end?: string | null
          period_start?: string | null
          priority_actions?: Json | null
          prompt_suggestions?: string[] | null
          recommendations?: Json | null
          report_date?: string
          strengths?: Json | null
          success_rate?: number | null
          summary?: string | null
          total_conversations?: number | null
          updated_at?: string | null
          weaknesses?: Json | null
        }
        Update: {
          agent_id?: string | null
          avg_duration_seconds?: number | null
          avg_satisfaction?: number | null
          conversations_analyzed?: number | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          kb_suggestions?: string[] | null
          language?: string
          organization_id?: string | null
          period_days?: string
          period_end?: string | null
          period_start?: string | null
          priority_actions?: Json | null
          prompt_suggestions?: string[] | null
          recommendations?: Json | null
          report_date?: string
          strengths?: Json | null
          success_rate?: number | null
          summary?: string | null
          total_conversations?: number | null
          updated_at?: string | null
          weaknesses?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_daily_reports_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_daily_reports_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_daily_reports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_health_scores: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          negative_sentiments: number | null
          organization_id: string | null
          overall_health_score: number | null
          period_end: string
          period_start: string
          positive_sentiments: number | null
          resolution_rate: number | null
          resolved_conversations: number | null
          satisfaction_score: number | null
          sentiment_score: number | null
          total_conversations: number | null
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          negative_sentiments?: number | null
          organization_id?: string | null
          overall_health_score?: number | null
          period_end: string
          period_start: string
          positive_sentiments?: number | null
          resolution_rate?: number | null
          resolved_conversations?: number | null
          satisfaction_score?: number | null
          sentiment_score?: number | null
          total_conversations?: number | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          negative_sentiments?: number | null
          organization_id?: string | null
          overall_health_score?: number | null
          period_end?: string
          period_start?: string
          positive_sentiments?: number | null
          resolution_rate?: number | null
          resolved_conversations?: number | null
          satisfaction_score?: number | null
          sentiment_score?: number | null
          total_conversations?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_health_scores_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_health_scores_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_health_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_insights: {
        Row: {
          agent_id: string | null
          alert_sent: boolean | null
          analyzed_at: string | null
          conversation_id: string
          created_at: string | null
          id: string
          improvements: Json | null
          language: string
          organization_id: string | null
          overall_sentiment: string | null
          satisfaction_score: number | null
          sentiment_timeline: Json | null
          smart_tags: string[] | null
        }
        Insert: {
          agent_id?: string | null
          alert_sent?: boolean | null
          analyzed_at?: string | null
          conversation_id: string
          created_at?: string | null
          id?: string
          improvements?: Json | null
          language?: string
          organization_id?: string | null
          overall_sentiment?: string | null
          satisfaction_score?: number | null
          sentiment_timeline?: Json | null
          smart_tags?: string[] | null
        }
        Update: {
          agent_id?: string | null
          alert_sent?: boolean | null
          analyzed_at?: string | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          improvements?: Json | null
          language?: string
          organization_id?: string | null
          overall_sentiment?: string | null
          satisfaction_score?: number | null
          sentiment_timeline?: Json | null
          smart_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_insights_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_insights_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_mcp_servers: {
        Row: {
          agent_id: string
          auth_config: Json | null
          auth_type: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_connected_at: string | null
          name: string
          organization_id: string
          server_type: string
          server_url: string
          tools_enabled: string[] | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          auth_config?: Json | null
          auth_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          name: string
          organization_id: string
          server_type?: string
          server_url: string
          tools_enabled?: string[] | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          auth_config?: Json | null
          auth_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_connected_at?: string | null
          name?: string
          organization_id?: string
          server_type?: string
          server_url?: string
          tools_enabled?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_mcp_servers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_mcp_servers_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_mcp_servers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_platform_webhooks: {
        Row: {
          agent_id: string
          created_at: string | null
          error_count: number | null
          events: string[]
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          organization_id: string
          platform: string
          updated_at: string | null
          webhook_secret: string | null
          webhook_url: string
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          error_count?: number | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          organization_id: string
          platform: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url: string
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          error_count?: number | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          organization_id?: string
          platform?: string
          updated_at?: string | null
          webhook_secret?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_platform_webhooks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_platform_webhooks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_platform_webhooks_organization_id_fkey"
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
          slug: string | null
          theme_config: Json | null
          twilio_number: string | null
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
          slug?: string | null
          theme_config?: Json | null
          twilio_number?: string | null
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
          slug?: string | null
          theme_config?: Json | null
          twilio_number?: string | null
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
            foreignKeyName: "agents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
            foreignKeyName: "agents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
      alert_notifications: {
        Row: {
          agent_id: string | null
          alert_type: string
          conversation_id: string
          created_at: string | null
          email_sent_to: string[] | null
          id: string
          organization_id: string | null
          satisfaction_score: number | null
        }
        Insert: {
          agent_id?: string | null
          alert_type: string
          conversation_id: string
          created_at?: string | null
          email_sent_to?: string[] | null
          id?: string
          organization_id?: string | null
          satisfaction_score?: number | null
        }
        Update: {
          agent_id?: string | null
          alert_type?: string
          conversation_id?: string
          created_at?: string | null
          email_sent_to?: string[] | null
          id?: string
          organization_id?: string | null
          satisfaction_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_notifications_organization_id_fkey"
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
      appointments: {
        Row: {
          agent_id: string | null
          attendee_email: string | null
          attendee_name: string | null
          attendee_phone: string | null
          calendar_integration_id: string | null
          client_id: string | null
          conversation_id: string | null
          created_at: string
          description: string | null
          end_time: string
          external_event_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          calendar_integration_id?: string | null
          client_id?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          external_event_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          attendee_email?: string | null
          attendee_name?: string | null
          attendee_phone?: string | null
          calendar_integration_id?: string | null
          client_id?: string | null
          conversation_id?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          external_event_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_calendar_integration_id_fkey"
            columns: ["calendar_integration_id"]
            isOneToOne: false
            referencedRelation: "calendar_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_calendar_integration_id_fkey"
            columns: ["calendar_integration_id"]
            isOneToOne: false
            referencedRelation: "calendar_integrations_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
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
          performance_billing_enabled: boolean | null
          plan_tier: string | null
          price_per_appointment: number | null
          price_per_converted_lead: number | null
          price_per_qualified_lead: number | null
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
          performance_billing_enabled?: boolean | null
          plan_tier?: string | null
          price_per_appointment?: number | null
          price_per_converted_lead?: number | null
          price_per_qualified_lead?: number | null
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
          performance_billing_enabled?: boolean | null
          plan_tier?: string | null
          price_per_appointment?: number | null
          price_per_converted_lead?: number | null
          price_per_qualified_lead?: number | null
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
      calendar_integrations: {
        Row: {
          access_token: string | null
          calendar_id: string | null
          created_at: string
          id: string
          is_active: boolean | null
          organization_id: string
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id: string
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          calendar_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          organization_id?: string
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
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
      client_agent_assignments: {
        Row: {
          agent_id: string
          can_edit_knowledge: boolean | null
          can_edit_prompt: boolean | null
          client_id: string
          created_at: string
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          can_edit_knowledge?: boolean | null
          can_edit_prompt?: boolean | null
          client_id: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          can_edit_knowledge?: boolean | null
          can_edit_prompt?: boolean | null
          client_id?: string
          created_at?: string
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_agent_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_agent_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_agent_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_agent_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      client_credentials: {
        Row: {
          client_id: string
          created_at: string
          password_hash: string | null
          password_reset_expires_at: string | null
          password_reset_token: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          password_hash?: string | null
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          password_hash?: string | null
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      client_member_credentials: {
        Row: {
          created_at: string
          member_id: string
          password_hash: string | null
          password_reset_expires_at: string | null
          password_reset_token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          member_id: string
          password_hash?: string | null
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          member_id?: string
          password_hash?: string | null
          password_reset_expires_at?: string | null
          password_reset_token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_member_credentials_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "client_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_member_credentials_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "client_members_safe"
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
          last_login_at: string | null
          login_id: string | null
          name: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          login_id?: string | null
          name?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          login_id?: string | null
          name?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
            foreignKeyName: "clients_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
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
      conversation_tags: {
        Row: {
          conversation_id: string
          tag_id: string
          tagged_at: string
          tagged_by: string | null
        }
        Insert: {
          conversation_id: string
          tag_id: string
          tagged_at?: string
          tagged_by?: string | null
        }
        Update: {
          conversation_id?: string
          tag_id?: string
          tagged_at?: string
          tagged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_tags_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "custom_tags"
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
          smart_tags: string[] | null
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
          smart_tags?: string[] | null
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
          smart_tags?: string[] | null
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
            foreignKeyName: "conversations_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
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
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
      custom_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          icon: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          icon?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_tags_organization_id_fkey"
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
      handoff_requests: {
        Row: {
          accepted_at: string | null
          agent_id: string | null
          chat_messages: Json | null
          completed_at: string | null
          conversation_id: string | null
          customer_info: Json | null
          human_agent_id: string | null
          id: string
          metadata: Json | null
          organization_id: string
          priority: string | null
          reason: string | null
          requested_at: string | null
          status: string | null
          transcript_snapshot: string | null
        }
        Insert: {
          accepted_at?: string | null
          agent_id?: string | null
          chat_messages?: Json | null
          completed_at?: string | null
          conversation_id?: string | null
          customer_info?: Json | null
          human_agent_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id: string
          priority?: string | null
          reason?: string | null
          requested_at?: string | null
          status?: string | null
          transcript_snapshot?: string | null
        }
        Update: {
          accepted_at?: string | null
          agent_id?: string | null
          chat_messages?: Json | null
          completed_at?: string | null
          conversation_id?: string | null
          customer_info?: Json | null
          human_agent_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string
          priority?: string | null
          reason?: string | null
          requested_at?: string | null
          status?: string | null
          transcript_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoff_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_requests_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_requests_organization_id_fkey"
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
      leads: {
        Row: {
          agent_id: string | null
          client_id: string | null
          conversation_id: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          id: string
          metadata: Json | null
          name: string | null
          organization_id: string
          phone: string | null
          qualified_at: string | null
          score: number | null
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          client_id?: string | null
          conversation_id?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          organization_id: string
          phone?: string | null
          qualified_at?: string | null
          score?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          client_id?: string | null
          conversation_id?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          metadata?: Json | null
          name?: string | null
          organization_id?: string
          phone?: string | null
          qualified_at?: string | null
          score?: number | null
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lemtel_cdrs_cache: {
        Row: {
          ai_processing: boolean
          analyzed: boolean
          answer_stamp: string | null
          billsec: number
          call_uuid: string
          caller_destination: string | null
          caller_id_name: string | null
          caller_id_number: string | null
          created_at: string
          customer_id: string | null
          direction: string | null
          duration: number
          end_stamp: string | null
          id: string
          missed_call: boolean
          record_name: string | null
          record_path: string | null
          start_stamp: string | null
          transcribed: boolean
          voicemail_message: boolean
        }
        Insert: {
          ai_processing?: boolean
          analyzed?: boolean
          answer_stamp?: string | null
          billsec?: number
          call_uuid: string
          caller_destination?: string | null
          caller_id_name?: string | null
          caller_id_number?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string | null
          duration?: number
          end_stamp?: string | null
          id?: string
          missed_call?: boolean
          record_name?: string | null
          record_path?: string | null
          start_stamp?: string | null
          transcribed?: boolean
          voicemail_message?: boolean
        }
        Update: {
          ai_processing?: boolean
          analyzed?: boolean
          answer_stamp?: string | null
          billsec?: number
          call_uuid?: string
          caller_destination?: string | null
          caller_id_name?: string | null
          caller_id_number?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string | null
          duration?: number
          end_stamp?: string | null
          id?: string
          missed_call?: boolean
          record_name?: string | null
          record_path?: string | null
          start_stamp?: string | null
          transcribed?: boolean
          voicemail_message?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lemtel_cdrs_cache_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lemtel_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lemtel_config: {
        Row: {
          created_at: string
          id: string
          is_secret: boolean
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_secret?: boolean
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_secret?: boolean
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      lemtel_customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          plan: string
          portal_enabled: boolean
          portal_user_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          plan?: string
          portal_enabled?: boolean
          portal_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          plan?: string
          portal_enabled?: boolean
          portal_user_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lemtel_dids: {
        Row: {
          assigned_id: string | null
          assigned_type: string
          created_at: string
          customer_id: string | null
          id: string
          number: string
          sms_enabled: boolean
          status: string
          telnyx_enabled: boolean
          updated_at: string
        }
        Insert: {
          assigned_id?: string | null
          assigned_type?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          number: string
          sms_enabled?: boolean
          status?: string
          telnyx_enabled?: boolean
          updated_at?: string
        }
        Update: {
          assigned_id?: string | null
          assigned_type?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          number?: string
          sms_enabled?: boolean
          status?: string
          telnyx_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lemtel_dids_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lemtel_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lemtel_ivr_audio: {
        Row: {
          audio_url: string | null
          created_at: string
          customer_id: string | null
          elevenlabs_voice_id: string | null
          id: string
          ivr_menu_id: string | null
          script_text: string | null
          status: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          created_at?: string
          customer_id?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          ivr_menu_id?: string | null
          script_text?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          created_at?: string
          customer_id?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          ivr_menu_id?: string | null
          script_text?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lemtel_ivr_audio_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lemtel_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lemtel_sms_threads: {
        Row: {
          contact_name: string | null
          contact_number: string
          created_at: string
          customer_id: string | null
          did_number: string
          id: string
          last_message_at: string
          messages: Json
          unread_count: number
          updated_at: string
        }
        Insert: {
          contact_name?: string | null
          contact_number: string
          created_at?: string
          customer_id?: string | null
          did_number: string
          id?: string
          last_message_at?: string
          messages?: Json
          unread_count?: number
          updated_at?: string
        }
        Update: {
          contact_name?: string | null
          contact_number?: string
          created_at?: string
          customer_id?: string | null
          did_number?: string
          id?: string
          last_message_at?: string
          messages?: Json
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lemtel_sms_threads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lemtel_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lemtel_softphone_users: {
        Row: {
          created_at: string
          customer_id: string | null
          device_type: string
          display_name: string | null
          extension: string
          id: string
          last_seen: string | null
          portal_user_id: string | null
          sip_domain: string | null
          sip_password: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          device_type?: string
          display_name?: string | null
          extension: string
          id?: string
          last_seen?: string | null
          portal_user_id?: string | null
          sip_domain?: string | null
          sip_password?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          device_type?: string
          display_name?: string | null
          extension?: string
          id?: string
          last_seen?: string | null
          portal_user_id?: string | null
          sip_domain?: string | null
          sip_password?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lemtel_softphone_users_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lemtel_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      lemtel_transcriptions: {
        Row: {
          action_items: string[] | null
          ai_model: string
          call_uuid: string
          created_at: string
          escalation_needed: boolean
          id: string
          key_phrases: string[] | null
          satisfaction_score: number | null
          sentiment: string | null
          summary: string | null
          topics: string[] | null
          transcript_text: string | null
        }
        Insert: {
          action_items?: string[] | null
          ai_model?: string
          call_uuid: string
          created_at?: string
          escalation_needed?: boolean
          id?: string
          key_phrases?: string[] | null
          satisfaction_score?: number | null
          sentiment?: string | null
          summary?: string | null
          topics?: string[] | null
          transcript_text?: string | null
        }
        Update: {
          action_items?: string[] | null
          ai_model?: string
          call_uuid?: string
          created_at?: string
          escalation_needed?: boolean
          id?: string
          key_phrases?: string[] | null
          satisfaction_score?: number | null
          sentiment?: string | null
          summary?: string | null
          topics?: string[] | null
          transcript_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lemtel_transcriptions_call_uuid_fkey"
            columns: ["call_uuid"]
            isOneToOne: false
            referencedRelation: "lemtel_cdrs_cache"
            referencedColumns: ["call_uuid"]
          },
        ]
      }
      lemtel_voice_agents: {
        Row: {
          avg_duration: number
          created_at: string
          customer_id: string | null
          description: string | null
          did_id: string | null
          elevenlabs_agent_id: string
          escalation_rate: number
          extension: string | null
          id: string
          name: string
          status: string
          total_calls: number
          updated_at: string
        }
        Insert: {
          avg_duration?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          did_id?: string | null
          elevenlabs_agent_id: string
          escalation_rate?: number
          extension?: string | null
          id?: string
          name: string
          status?: string
          total_calls?: number
          updated_at?: string
        }
        Update: {
          avg_duration?: number
          created_at?: string
          customer_id?: string | null
          description?: string | null
          did_id?: string | null
          elevenlabs_agent_id?: string
          escalation_rate?: number
          extension?: string | null
          id?: string
          name?: string
          status?: string
          total_calls?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lemtel_voice_agents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "lemtel_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lemtel_voice_agents_did_id_fkey"
            columns: ["did_id"]
            isOneToOne: false
            referencedRelation: "lemtel_dids"
            referencedColumns: ["id"]
          },
        ]
      }
      org_exports: {
        Row: {
          content: string
          created_at: string
          created_by: string
          export_type: string
          filename: string
          filters: Json
          format: string
          id: string
          mime: string
          organization_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          export_type: string
          filename: string
          filters?: Json
          format: string
          id?: string
          mime: string
          organization_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          export_type?: string
          filename?: string
          filters?: Json
          format?: string
          id?: string
          mime?: string
          organization_id?: string
        }
        Relationships: []
      }
      org_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          level: string
          metadata: Json
          organization_id: string
          read_at: string | null
          recipient_role: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          level?: string
          metadata?: Json
          organization_id: string
          read_at?: string | null
          recipient_role?: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          level?: string
          metadata?: Json
          organization_id?: string
          read_at?: string | null
          recipient_role?: Database["public"]["Enums"]["app_role"] | null
          recipient_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      org_retention_settings: {
        Row: {
          exports_retention_days: number
          notifications_retention_days: number
          organization_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          exports_retention_days?: number
          notifications_retention_days?: number
          organization_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          exports_retention_days?: number
          notifications_retention_days?: number
          organization_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      org_role_permissions: {
        Row: {
          allowed: boolean
          id: string
          organization_id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          allowed?: boolean
          id?: string
          organization_id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          allowed?: boolean
          id?: string
          organization_id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          allowed_platforms: string[] | null
          api_key: string | null
          baa_signed_at: string | null
          baa_signed_by: string | null
          backend_domain: string | null
          client_limit: number | null
          client_portal_favicon_url: string | null
          client_portal_logo_url: string | null
          client_portal_primary_color: string | null
          client_portal_title: string | null
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
          allowed_platforms?: string[] | null
          api_key?: string | null
          baa_signed_at?: string | null
          baa_signed_by?: string | null
          backend_domain?: string | null
          client_limit?: number | null
          client_portal_favicon_url?: string | null
          client_portal_logo_url?: string | null
          client_portal_primary_color?: string | null
          client_portal_title?: string | null
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
          allowed_platforms?: string[] | null
          api_key?: string | null
          baa_signed_at?: string | null
          baa_signed_by?: string | null
          backend_domain?: string | null
          client_limit?: number | null
          client_portal_favicon_url?: string | null
          client_portal_logo_url?: string | null
          client_portal_primary_color?: string | null
          client_portal_title?: string | null
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
            foreignKeyName: "outbound_campaigns_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
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
      pbx_ai_insights: {
        Row: {
          action_items: string[] | null
          ai_model: string | null
          call_record_id: string | null
          client_id: string | null
          created_at: string | null
          escalation_needed: boolean | null
          id: string
          intent: string | null
          key_phrases: string[] | null
          organization_id: string
          prompt_version: string | null
          quality_score: number | null
          risks: string[] | null
          sales_opportunities: string[] | null
          satisfaction_score: number | null
          sentiment: string | null
          summary: string | null
          topics: string[] | null
        }
        Insert: {
          action_items?: string[] | null
          ai_model?: string | null
          call_record_id?: string | null
          client_id?: string | null
          created_at?: string | null
          escalation_needed?: boolean | null
          id?: string
          intent?: string | null
          key_phrases?: string[] | null
          organization_id: string
          prompt_version?: string | null
          quality_score?: number | null
          risks?: string[] | null
          sales_opportunities?: string[] | null
          satisfaction_score?: number | null
          sentiment?: string | null
          summary?: string | null
          topics?: string[] | null
        }
        Update: {
          action_items?: string[] | null
          ai_model?: string | null
          call_record_id?: string | null
          client_id?: string | null
          created_at?: string | null
          escalation_needed?: boolean | null
          id?: string
          intent?: string | null
          key_phrases?: string[] | null
          organization_id?: string
          prompt_version?: string | null
          quality_score?: number | null
          risks?: string[] | null
          sales_opportunities?: string[] | null
          satisfaction_score?: number | null
          sentiment?: string | null
          summary?: string | null
          topics?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_ai_insights_call_record_id_fkey"
            columns: ["call_record_id"]
            isOneToOne: false
            referencedRelation: "pbx_call_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ai_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ai_insights_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ai_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_call_queues: {
        Row: {
          client_id: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          extension: string | null
          id: string
          max_wait_time: number | null
          music_on_hold: string | null
          name: string
          organization_id: string
          pbx_uuid: string | null
          raw_data: Json | null
          record_enabled: boolean | null
          strategy: string | null
          timeout_action: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          extension?: string | null
          id?: string
          max_wait_time?: number | null
          music_on_hold?: string | null
          name: string
          organization_id: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          record_enabled?: boolean | null
          strategy?: string | null
          timeout_action?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          extension?: string | null
          id?: string
          max_wait_time?: number | null
          music_on_hold?: string | null
          name?: string
          organization_id?: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          record_enabled?: boolean | null
          strategy?: string | null
          timeout_action?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_call_queues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_queues_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_queues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_call_recordings: {
        Row: {
          call_record_id: string | null
          client_id: string | null
          created_at: string | null
          direction: string | null
          duration_seconds: number | null
          file_url: string | null
          id: string
          organization_id: string
          pbx_uuid: string | null
          raw_data: Json | null
          recorded_at: string | null
          storage_path: string | null
          transcription_status: string | null
        }
        Insert: {
          call_record_id?: string | null
          client_id?: string | null
          created_at?: string | null
          direction?: string | null
          duration_seconds?: number | null
          file_url?: string | null
          id?: string
          organization_id: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          recorded_at?: string | null
          storage_path?: string | null
          transcription_status?: string | null
        }
        Update: {
          call_record_id?: string | null
          client_id?: string | null
          created_at?: string | null
          direction?: string | null
          duration_seconds?: number | null
          file_url?: string | null
          id?: string
          organization_id?: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          recorded_at?: string | null
          storage_path?: string | null
          transcription_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_call_recordings_call_record_id_fkey"
            columns: ["call_record_id"]
            isOneToOne: false
            referencedRelation: "pbx_call_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_recordings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_recordings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_recordings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_call_records: {
        Row: {
          ai_processing: boolean | null
          analyzed: boolean | null
          answer_at: string | null
          billsec: number | null
          call_status: string | null
          caller_name: string | null
          caller_number: string | null
          client_id: string | null
          codec: string | null
          created_at: string | null
          destination: string | null
          destination_number: string | null
          direction: string | null
          domain_name: string | null
          domain_uuid: string | null
          duration_seconds: number | null
          end_at: string | null
          extension: string | null
          extension_uuid: string | null
          hangup_cause: string | null
          has_recording: boolean | null
          id: string
          ivr_menu_uuid: string | null
          missed_call: boolean | null
          mos: number | null
          organization_id: string
          pbx_uuid: string | null
          pdd: number | null
          pdd_ms: number | null
          raw_data: Json | null
          recording_name: string | null
          recording_path: string | null
          recording_url: string | null
          ring_group_uuid: string | null
          sip_call_id: string | null
          source_number: string | null
          start_at: string | null
          transcribed: boolean | null
          tta: number | null
          voicemail_message: string | null
          waitsec: number | null
        }
        Insert: {
          ai_processing?: boolean | null
          analyzed?: boolean | null
          answer_at?: string | null
          billsec?: number | null
          call_status?: string | null
          caller_name?: string | null
          caller_number?: string | null
          client_id?: string | null
          codec?: string | null
          created_at?: string | null
          destination?: string | null
          destination_number?: string | null
          direction?: string | null
          domain_name?: string | null
          domain_uuid?: string | null
          duration_seconds?: number | null
          end_at?: string | null
          extension?: string | null
          extension_uuid?: string | null
          hangup_cause?: string | null
          has_recording?: boolean | null
          id?: string
          ivr_menu_uuid?: string | null
          missed_call?: boolean | null
          mos?: number | null
          organization_id: string
          pbx_uuid?: string | null
          pdd?: number | null
          pdd_ms?: number | null
          raw_data?: Json | null
          recording_name?: string | null
          recording_path?: string | null
          recording_url?: string | null
          ring_group_uuid?: string | null
          sip_call_id?: string | null
          source_number?: string | null
          start_at?: string | null
          transcribed?: boolean | null
          tta?: number | null
          voicemail_message?: string | null
          waitsec?: number | null
        }
        Update: {
          ai_processing?: boolean | null
          analyzed?: boolean | null
          answer_at?: string | null
          billsec?: number | null
          call_status?: string | null
          caller_name?: string | null
          caller_number?: string | null
          client_id?: string | null
          codec?: string | null
          created_at?: string | null
          destination?: string | null
          destination_number?: string | null
          direction?: string | null
          domain_name?: string | null
          domain_uuid?: string | null
          duration_seconds?: number | null
          end_at?: string | null
          extension?: string | null
          extension_uuid?: string | null
          hangup_cause?: string | null
          has_recording?: boolean | null
          id?: string
          ivr_menu_uuid?: string | null
          missed_call?: boolean | null
          mos?: number | null
          organization_id?: string
          pbx_uuid?: string | null
          pdd?: number | null
          pdd_ms?: number | null
          raw_data?: Json | null
          recording_name?: string | null
          recording_path?: string | null
          recording_url?: string | null
          ring_group_uuid?: string | null
          sip_call_id?: string | null
          source_number?: string | null
          start_at?: string | null
          transcribed?: boolean | null
          tta?: number | null
          voicemail_message?: string | null
          waitsec?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_call_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_records_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_call_transcripts: {
        Row: {
          call_record_id: string | null
          client_id: string | null
          confidence: number | null
          created_at: string | null
          id: string
          language: string | null
          organization_id: string
          provider: string | null
          recording_id: string | null
          speaker_segments: Json | null
          transcript_text: string | null
        }
        Insert: {
          call_record_id?: string | null
          client_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          language?: string | null
          organization_id: string
          provider?: string | null
          recording_id?: string | null
          speaker_segments?: Json | null
          transcript_text?: string | null
        }
        Update: {
          call_record_id?: string | null
          client_id?: string | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          language?: string | null
          organization_id?: string
          provider?: string | null
          recording_id?: string | null
          speaker_segments?: Json | null
          transcript_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_call_transcripts_call_record_id_fkey"
            columns: ["call_record_id"]
            isOneToOne: false
            referencedRelation: "pbx_call_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_transcripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_transcripts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_transcripts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_call_transcripts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "pbx_call_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_devices: {
        Row: {
          assigned_extension_id: string | null
          client_id: string | null
          created_at: string | null
          enabled: boolean | null
          id: string
          label: string | null
          last_seen_at: string | null
          mac_address: string | null
          organization_id: string
          pbx_uuid: string | null
          profile: string | null
          raw_data: Json | null
          registration_status: string | null
          template: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          assigned_extension_id?: string | null
          client_id?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          label?: string | null
          last_seen_at?: string | null
          mac_address?: string | null
          organization_id: string
          pbx_uuid?: string | null
          profile?: string | null
          raw_data?: Json | null
          registration_status?: string | null
          template?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          assigned_extension_id?: string | null
          client_id?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          label?: string | null
          last_seen_at?: string | null
          mac_address?: string | null
          organization_id?: string
          pbx_uuid?: string | null
          profile?: string | null
          raw_data?: Json | null
          registration_status?: string | null
          template?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_devices_assigned_extension_id_fkey"
            columns: ["assigned_extension_id"]
            isOneToOne: false
            referencedRelation: "pbx_extensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_devices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_devices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_extensions: {
        Row: {
          call_group: string | null
          call_recording: string | null
          client_id: string | null
          created_at: string | null
          description: string | null
          do_not_disturb: boolean | null
          effective_cid_name: string | null
          effective_cid_number: string | null
          enabled: boolean | null
          extension: string
          forward_all_destination: string | null
          id: string
          organization_id: string
          pbx_uuid: string | null
          raw_data: Json | null
          synced_at: string | null
          updated_at: string | null
          voicemail_enabled: boolean | null
        }
        Insert: {
          call_group?: string | null
          call_recording?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          do_not_disturb?: boolean | null
          effective_cid_name?: string | null
          effective_cid_number?: string | null
          enabled?: boolean | null
          extension: string
          forward_all_destination?: string | null
          id?: string
          organization_id: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          updated_at?: string | null
          voicemail_enabled?: boolean | null
        }
        Update: {
          call_group?: string | null
          call_recording?: string | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          do_not_disturb?: boolean | null
          effective_cid_name?: string | null
          effective_cid_number?: string | null
          enabled?: boolean | null
          extension?: string
          forward_all_destination?: string | null
          id?: string
          organization_id?: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          synced_at?: string | null
          updated_at?: string | null
          voicemail_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_extensions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_extensions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_extensions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_feature_codes: {
        Row: {
          activate_code: string | null
          deactivate_code: string | null
          dial_code: string | null
          enabled: boolean | null
          feature: string
          id: string
          organization_id: string
        }
        Insert: {
          activate_code?: string | null
          deactivate_code?: string | null
          dial_code?: string | null
          enabled?: boolean | null
          feature: string
          id?: string
          organization_id: string
        }
        Update: {
          activate_code?: string | null
          deactivate_code?: string | null
          dial_code?: string | null
          enabled?: boolean | null
          feature?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pbx_feature_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_integrations: {
        Row: {
          base_url: string | null
          config: Json | null
          created_at: string | null
          domain: string | null
          id: string
          last_sync_at: string | null
          organization_id: string
          provider: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          base_url?: string | null
          config?: Json | null
          created_at?: string | null
          domain?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id: string
          provider?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          base_url?: string | null
          config?: Json | null
          created_at?: string | null
          domain?: string | null
          id?: string
          last_sync_at?: string | null
          organization_id?: string
          provider?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_ivr_audio: {
        Row: {
          audio_url: string | null
          client_id: string | null
          created_at: string | null
          elevenlabs_voice_id: string | null
          id: string
          ivr_id: string | null
          language: string | null
          organization_id: string
          script_text: string | null
          status: string | null
          storage_path: string | null
        }
        Insert: {
          audio_url?: string | null
          client_id?: string | null
          created_at?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          ivr_id?: string | null
          language?: string | null
          organization_id: string
          script_text?: string | null
          status?: string | null
          storage_path?: string | null
        }
        Update: {
          audio_url?: string | null
          client_id?: string | null
          created_at?: string | null
          elevenlabs_voice_id?: string | null
          id?: string
          ivr_id?: string | null
          language?: string | null
          organization_id?: string
          script_text?: string | null
          status?: string | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_ivr_audio_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ivr_audio_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ivr_audio_ivr_id_fkey"
            columns: ["ivr_id"]
            isOneToOne: false
            referencedRelation: "pbx_ivrs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ivr_audio_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_ivr_options: {
        Row: {
          description: string | null
          destination_id: string | null
          destination_type: string | null
          digit: string
          id: string
          ivr_id: string
          sort_order: number | null
        }
        Insert: {
          description?: string | null
          destination_id?: string | null
          destination_type?: string | null
          digit: string
          id?: string
          ivr_id: string
          sort_order?: number | null
        }
        Update: {
          description?: string | null
          destination_id?: string | null
          destination_type?: string | null
          digit?: string
          id?: string
          ivr_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_ivr_options_ivr_id_fkey"
            columns: ["ivr_id"]
            isOneToOne: false
            referencedRelation: "pbx_ivrs"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_ivrs: {
        Row: {
          client_id: string | null
          created_at: string | null
          description: string | null
          direct_dial: boolean | null
          enabled: boolean | null
          exit_action: string | null
          extension: string | null
          greet_long: string | null
          greet_short: string | null
          id: string
          name: string
          organization_id: string
          pbx_uuid: string | null
          raw_data: Json | null
          ringback: string | null
          timeout_ms: number | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          direct_dial?: boolean | null
          enabled?: boolean | null
          exit_action?: string | null
          extension?: string | null
          greet_long?: string | null
          greet_short?: string | null
          id?: string
          name: string
          organization_id: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          ringback?: string | null
          timeout_ms?: number | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          direct_dial?: boolean | null
          enabled?: boolean | null
          exit_action?: string | null
          extension?: string | null
          greet_long?: string | null
          greet_short?: string | null
          id?: string
          name?: string
          organization_id?: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          ringback?: string | null
          timeout_ms?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_ivrs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ivrs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ivrs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_phone_number_assignments: {
        Row: {
          ai_enabled: boolean | null
          client_id: string | null
          created_at: string | null
          destination_id: string | null
          destination_type: string | null
          id: string
          organization_id: string
          phone_number_id: string | null
          routing_rules: Json | null
          sms_enabled: boolean | null
          updated_at: string | null
          voice_agent_id: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          client_id?: string | null
          created_at?: string | null
          destination_id?: string | null
          destination_type?: string | null
          id?: string
          organization_id: string
          phone_number_id?: string | null
          routing_rules?: Json | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          voice_agent_id?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          client_id?: string | null
          created_at?: string | null
          destination_id?: string | null
          destination_type?: string | null
          id?: string
          organization_id?: string
          phone_number_id?: string | null
          routing_rules?: Json | null
          sms_enabled?: boolean | null
          updated_at?: string | null
          voice_agent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_phone_number_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_phone_number_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_phone_number_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_phone_number_assignments_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_phone_number_assignments_voice_agent_id_fkey"
            columns: ["voice_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_phone_number_assignments_voice_agent_id_fkey"
            columns: ["voice_agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_queue_agents: {
        Row: {
          agent_id: string | null
          agent_name: string | null
          extension_id: string | null
          id: string
          queue_id: string
          raw_data: Json | null
          status: string | null
          tier_level: number | null
          tier_position: number | null
          wrap_up_time: number | null
        }
        Insert: {
          agent_id?: string | null
          agent_name?: string | null
          extension_id?: string | null
          id?: string
          queue_id: string
          raw_data?: Json | null
          status?: string | null
          tier_level?: number | null
          tier_position?: number | null
          wrap_up_time?: number | null
        }
        Update: {
          agent_id?: string | null
          agent_name?: string | null
          extension_id?: string | null
          id?: string
          queue_id?: string
          raw_data?: Json | null
          status?: string | null
          tier_level?: number | null
          tier_position?: number | null
          wrap_up_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_queue_agents_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "pbx_extensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_queue_agents_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "pbx_call_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_ring_groups: {
        Row: {
          client_id: string | null
          created_at: string | null
          description: string | null
          enabled: boolean | null
          extension: string | null
          forwarding: string | null
          id: string
          name: string
          organization_id: string
          pbx_uuid: string | null
          raw_data: Json | null
          strategy: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          extension?: string | null
          forwarding?: string | null
          id?: string
          name: string
          organization_id: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          strategy?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          enabled?: boolean | null
          extension?: string | null
          forwarding?: string | null
          id?: string
          name?: string
          organization_id?: string
          pbx_uuid?: string | null
          raw_data?: Json | null
          strategy?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_ring_groups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ring_groups_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_ring_groups_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_sms_messages: {
        Row: {
          body: string | null
          direction: string
          from_number: string | null
          id: string
          media_urls: Json | null
          organization_id: string
          provider_message_id: string | null
          raw_data: Json | null
          sent_at: string | null
          status: string | null
          thread_id: string
          to_number: string | null
        }
        Insert: {
          body?: string | null
          direction: string
          from_number?: string | null
          id?: string
          media_urls?: Json | null
          organization_id: string
          provider_message_id?: string | null
          raw_data?: Json | null
          sent_at?: string | null
          status?: string | null
          thread_id: string
          to_number?: string | null
        }
        Update: {
          body?: string | null
          direction?: string
          from_number?: string | null
          id?: string
          media_urls?: Json | null
          organization_id?: string
          provider_message_id?: string | null
          raw_data?: Json | null
          sent_at?: string | null
          status?: string | null
          thread_id?: string
          to_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_sms_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_sms_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "pbx_sms_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_sms_threads: {
        Row: {
          assigned_agent_id: string | null
          assigned_user_id: string | null
          client_id: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string | null
          did_number: string
          id: string
          last_message_at: string | null
          organization_id: string
          phone_number_id: string | null
          status: string | null
          unread_count: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_agent_id?: string | null
          assigned_user_id?: string | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string | null
          did_number: string
          id?: string
          last_message_at?: string | null
          organization_id: string
          phone_number_id?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_agent_id?: string | null
          assigned_user_id?: string | null
          client_id?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string | null
          did_number?: string
          id?: string
          last_message_at?: string | null
          organization_id?: string
          phone_number_id?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_sms_threads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_sms_threads_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_sms_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_sms_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_sms_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_sms_threads_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_softphone_users: {
        Row: {
          client_id: string | null
          created_at: string | null
          display_name: string | null
          extension: string
          extension_id: string | null
          id: string
          last_seen_at: string | null
          organization_id: string
          portal_user_id: string | null
          sip_domain: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          display_name?: string | null
          extension: string
          extension_id?: string | null
          id?: string
          last_seen_at?: string | null
          organization_id: string
          portal_user_id?: string | null
          sip_domain?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          display_name?: string | null
          extension?: string
          extension_id?: string | null
          id?: string
          last_seen_at?: string | null
          organization_id?: string
          portal_user_id?: string | null
          sip_domain?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_softphone_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_softphone_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_softphone_users_extension_id_fkey"
            columns: ["extension_id"]
            isOneToOne: false
            referencedRelation: "pbx_extensions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pbx_softphone_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pbx_sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error: string | null
          id: string
          job_type: string
          organization_id: string
          started_at: string | null
          stats: Json | null
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          job_type: string
          organization_id: string
          started_at?: string | null
          stats?: Json | null
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          job_type?: string
          organization_id?: string
          started_at?: string | null
          stats?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pbx_sync_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_metrics: {
        Row: {
          appointments_booked: number | null
          appointments_completed: number | null
          billable_amount: number | null
          billed_at: string | null
          conversations_count: number | null
          created_at: string
          id: string
          leads_converted: number | null
          leads_generated: number | null
          leads_qualified: number | null
          organization_id: string
          period_end: string
          period_start: string
          stripe_invoice_id: string | null
          total_duration_minutes: number | null
          updated_at: string
        }
        Insert: {
          appointments_booked?: number | null
          appointments_completed?: number | null
          billable_amount?: number | null
          billed_at?: string | null
          conversations_count?: number | null
          created_at?: string
          id?: string
          leads_converted?: number | null
          leads_generated?: number | null
          leads_qualified?: number | null
          organization_id: string
          period_end: string
          period_start: string
          stripe_invoice_id?: string | null
          total_duration_minutes?: number | null
          updated_at?: string
        }
        Update: {
          appointments_booked?: number | null
          appointments_completed?: number | null
          billable_amount?: number | null
          billed_at?: string | null
          conversations_count?: number | null
          created_at?: string
          id?: string
          leads_converted?: number | null
          leads_generated?: number | null
          leads_qualified?: number | null
          organization_id?: string
          period_end?: string
          period_start?: string
          stripe_invoice_id?: string | null
          total_duration_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_numbers: {
        Row: {
          capabilities: Json | null
          created_at: string | null
          friendly_name: string | null
          id: string
          is_verified: boolean | null
          metadata: Json | null
          monthly_cost: number | null
          organization_id: string
          phone_number: string
          provider: string
          provider_sid: string | null
          recording_enabled: boolean | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          capabilities?: Json | null
          created_at?: string | null
          friendly_name?: string | null
          id?: string
          is_verified?: boolean | null
          metadata?: Json | null
          monthly_cost?: number | null
          organization_id: string
          phone_number: string
          provider?: string
          provider_sid?: string | null
          recording_enabled?: boolean | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          capabilities?: Json | null
          created_at?: string | null
          friendly_name?: string | null
          id?: string
          is_verified?: boolean | null
          metadata?: Json | null
          monthly_cost?: number | null
          organization_id?: string
          phone_number?: string
          provider?: string
          provider_sid?: string | null
          recording_enabled?: boolean | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phone_numbers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_branding: {
        Row: {
          client_portal_favicon_url: string | null
          client_portal_logo_url: string | null
          client_portal_primary_color: string | null
          client_portal_title: string | null
          created_at: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          singleton: boolean
          updated_at: string
          updated_by: string | null
          website_title: string | null
        }
        Insert: {
          client_portal_favicon_url?: string | null
          client_portal_logo_url?: string | null
          client_portal_primary_color?: string | null
          client_portal_title?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          website_title?: string | null
        }
        Update: {
          client_portal_favicon_url?: string | null
          client_portal_logo_url?: string | null
          client_portal_primary_color?: string | null
          client_portal_title?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          website_title?: string | null
        }
        Relationships: []
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
      prompt_templates: {
        Row: {
          created_at: string
          description: string | null
          first_message: string | null
          id: string
          is_default: boolean | null
          max_tokens: number | null
          name: string
          organization_id: string | null
          system_prompt: string
          tags: string[] | null
          temperature: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          first_message?: string | null
          id?: string
          is_default?: boolean | null
          max_tokens?: number | null
          name: string
          organization_id?: string | null
          system_prompt: string
          tags?: string[] | null
          temperature?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          first_message?: string | null
          id?: string
          is_default?: boolean | null
          max_tokens?: number | null
          name?: string
          organization_id?: string | null
          system_prompt?: string
          tags?: string[] | null
          temperature?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      security_audit_runs: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          results: Json
          run_by: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          results?: Json
          run_by: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          results?: Json
          run_by?: string
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admin_exceptions: {
        Row: {
          created_at: string | null
          email: string
          id: string
          unlimited_clients: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          unlimited_clients?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          unlimited_clients?: boolean | null
          updated_at?: string | null
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
      twilio_active_calls: {
        Row: {
          agent_id: string | null
          call_sid: string
          direction: string
          duration: number | null
          ended_at: string | null
          from_number: string
          id: string
          organization_id: string | null
          recording_sid: string | null
          recording_url: string | null
          started_at: string | null
          status: string
          to_number: string
          updated_at: string | null
        }
        Insert: {
          agent_id?: string | null
          call_sid: string
          direction?: string
          duration?: number | null
          ended_at?: string | null
          from_number: string
          id?: string
          organization_id?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          to_number: string
          updated_at?: string | null
        }
        Update: {
          agent_id?: string | null
          call_sid?: string
          direction?: string
          duration?: number | null
          ended_at?: string | null
          from_number?: string
          id?: string
          organization_id?: string | null
          recording_sid?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string
          to_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "twilio_active_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twilio_active_calls_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "twilio_active_calls_organization_id_fkey"
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
      agents_safe: {
        Row: {
          assigned_to: string | null
          avatar_url: string | null
          branding_url: string | null
          client_id: string | null
          config: Json | null
          created_at: string | null
          description: string | null
          id: string | null
          is_external: boolean | null
          name: string | null
          organization_id: string | null
          platform: string | null
          platform_agent_id: string | null
          slug: string | null
          theme_config: Json | null
          twilio_number: string | null
          updated_at: string | null
          widget_layout: string | null
        }
        Insert: {
          assigned_to?: string | null
          avatar_url?: string | null
          branding_url?: string | null
          client_id?: string | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_external?: boolean | null
          name?: string | null
          organization_id?: string | null
          platform?: string | null
          platform_agent_id?: string | null
          slug?: string | null
          theme_config?: Json | null
          twilio_number?: string | null
          updated_at?: string | null
          widget_layout?: string | null
        }
        Update: {
          assigned_to?: string | null
          avatar_url?: string | null
          branding_url?: string | null
          client_id?: string | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          is_external?: boolean | null
          name?: string | null
          organization_id?: string | null
          platform?: string | null
          platform_agent_id?: string | null
          slug?: string | null
          theme_config?: Json | null
          twilio_number?: string | null
          updated_at?: string | null
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
            foreignKeyName: "agents_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
            foreignKeyName: "agents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
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
      calendar_integrations_safe: {
        Row: {
          calendar_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          is_token_valid: boolean | null
          organization_id: string | null
          provider: string | null
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          calendar_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          is_token_valid?: never
          organization_id?: string | null
          provider?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          calendar_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          is_token_valid?: never
          organization_id?: string | null
          provider?: string | null
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_members_safe: {
        Row: {
          client_id: string | null
          created_at: string | null
          email: string | null
          has_password: boolean | null
          id: string | null
          last_login_at: string | null
          login_id: string | null
          name: string | null
          role: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_safe: {
        Row: {
          access_controls: Json | null
          assigned_agent_id: string | null
          assigned_agents: number | null
          created_at: string | null
          created_by: string | null
          custom_css: string | null
          email: string | null
          has_password: boolean | null
          id: string | null
          language: string | null
          login_id: string | null
          name: string | null
          organization_id: string | null
          status: string | null
          theme: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
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
            foreignKeyName: "clients_assigned_agent_id_fkey"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "agents_safe"
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
      lemtel_config_safe: {
        Row: {
          id: string | null
          is_secret: boolean | null
          key: string | null
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string | null
          is_secret?: boolean | null
          key?: string | null
          updated_at?: string | null
          value?: never
        }
        Update: {
          id?: string | null
          is_secret?: boolean | null
          key?: string | null
          updated_at?: string | null
          value?: never
        }
        Relationships: []
      }
      organization_integrations_safe: {
        Row: {
          additional_config: Json | null
          agent_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_tested_at: string | null
          organization_id: string | null
          platform: string | null
          test_error: string | null
          test_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          additional_config?: Json | null
          agent_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_tested_at?: string | null
          organization_id?: string | null
          platform?: string | null
          test_error?: string | null
          test_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          additional_config?: Json | null
          agent_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_tested_at?: string | null
          organization_id?: string | null
          platform?: string | null
          test_error?: string | null
          test_status?: string | null
          updated_at?: string | null
          user_id?: string | null
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
    }
    Functions: {
      create_organization_for_user: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      generate_agent_slug: { Args: { agent_name: string }; Returns: string }
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
      increment_sms_unread: { Args: { thread_id: string }; Returns: undefined }
      is_lemtel_admin: { Args: { _user_id: string }; Returns: boolean }
      is_lemtel_member: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      log_agent_access: {
        Args: { _action: string; _metadata?: Json; _org_id: string }
        Returns: undefined
      }
      run_security_audit: { Args: { _org_id: string }; Returns: Json }
      setup_new_user_organization: {
        Args: { _full_name?: string; _user_email: string; _user_id: string }
        Returns: string
      }
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
