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
      client_assignments: {
        Row: {
          client_id: string
          created_at: string
          id: string
          membership_id: string
          organization_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          membership_id: string
          organization_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          membership_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_assignments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_membership_id_fkey"
            columns: ["membership_id"]
            isOneToOne: false
            referencedRelation: "memberships"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_contacts: {
        Row: {
          channel_preference: string
          client_id: string
          contact_role: string
          created_at: string
          do_not_contact: boolean
          do_not_contact_reason: string | null
          email: string | null
          email_bounce_type: string | null
          email_bounced: boolean
          email_bounced_at: string | null
          email_valid: boolean
          escalation_order: number
          full_name: string
          id: string
          imported_at: string | null
          is_primary: boolean
          last_synced_at: string | null
          opted_out: boolean
          opted_out_at: string | null
          opted_out_channel: string | null
          organization_id: string
          phone: string | null
          source_id: string | null
          source_system: string | null
          updated_at: string
          whatsapp_eligibility_checked_at: string | null
          whatsapp_eligible: boolean
          whatsapp_number: string | null
        }
        Insert: {
          channel_preference?: string
          client_id: string
          contact_role?: string
          created_at?: string
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          email?: string | null
          email_bounce_type?: string | null
          email_bounced?: boolean
          email_bounced_at?: string | null
          email_valid?: boolean
          escalation_order?: number
          full_name: string
          id?: string
          imported_at?: string | null
          is_primary?: boolean
          last_synced_at?: string | null
          opted_out?: boolean
          opted_out_at?: string | null
          opted_out_channel?: string | null
          organization_id: string
          phone?: string | null
          source_id?: string | null
          source_system?: string | null
          updated_at?: string
          whatsapp_eligibility_checked_at?: string | null
          whatsapp_eligible?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          channel_preference?: string
          client_id?: string
          contact_role?: string
          created_at?: string
          do_not_contact?: boolean
          do_not_contact_reason?: string | null
          email?: string | null
          email_bounce_type?: string | null
          email_bounced?: boolean
          email_bounced_at?: string | null
          email_valid?: boolean
          escalation_order?: number
          full_name?: string
          id?: string
          imported_at?: string | null
          is_primary?: boolean
          last_synced_at?: string | null
          opted_out?: boolean
          opted_out_at?: string | null
          opted_out_channel?: string | null
          organization_id?: string
          phone?: string | null
          source_id?: string | null
          source_system?: string | null
          updated_at?: string
          whatsapp_eligibility_checked_at?: string | null
          whatsapp_eligible?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_owner_user_id: string | null
          approval_policy_override: string | null
          archived_at: string | null
          channel_restriction: string[]
          client_status: string
          created_at: string
          default_payment_terms_days: number | null
          display_name: string
          do_not_automate: boolean
          escalation_preferences: Json
          id: string
          import_batch_id: string | null
          imported_at: string | null
          language_preference: string
          last_synced_at: string | null
          legal_name: string | null
          message_frequency_override: Json | null
          notes: string | null
          organization_id: string
          preferred_channel: string
          send_restrictions: Json
          sensitivity_level: string
          source_id: string | null
          source_system: string | null
          sync_run_id: string | null
          tags: string[]
          tone_override: string | null
          tone_override_instructions: string | null
          updated_at: string
          workflow_override_id: string | null
        }
        Insert: {
          account_owner_user_id?: string | null
          approval_policy_override?: string | null
          archived_at?: string | null
          channel_restriction?: string[]
          client_status?: string
          created_at?: string
          default_payment_terms_days?: number | null
          display_name: string
          do_not_automate?: boolean
          escalation_preferences?: Json
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          language_preference?: string
          last_synced_at?: string | null
          legal_name?: string | null
          message_frequency_override?: Json | null
          notes?: string | null
          organization_id: string
          preferred_channel?: string
          send_restrictions?: Json
          sensitivity_level?: string
          source_id?: string | null
          source_system?: string | null
          sync_run_id?: string | null
          tags?: string[]
          tone_override?: string | null
          tone_override_instructions?: string | null
          updated_at?: string
          workflow_override_id?: string | null
        }
        Update: {
          account_owner_user_id?: string | null
          approval_policy_override?: string | null
          archived_at?: string | null
          channel_restriction?: string[]
          client_status?: string
          created_at?: string
          default_payment_terms_days?: number | null
          display_name?: string
          do_not_automate?: boolean
          escalation_preferences?: Json
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          language_preference?: string
          last_synced_at?: string | null
          legal_name?: string | null
          message_frequency_override?: Json | null
          notes?: string | null
          organization_id?: string
          preferred_channel?: string
          send_restrictions?: Json
          sensitivity_level?: string
          source_id?: string | null
          source_system?: string | null
          sync_run_id?: string | null
          tags?: string[]
          tone_override?: string | null
          tone_override_instructions?: string | null
          updated_at?: string
          workflow_override_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_account_owner_user_id_fkey"
            columns: ["account_owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      import_batches: {
        Row: {
          column_mapping: Json
          created_at: string
          created_by_user_id: string
          duplicate_rows: number
          error_report_object_key: string | null
          failed_rows: number
          file_object_key: string | null
          id: string
          idempotency_hash: string | null
          import_type: string
          organization_id: string
          original_filename: string | null
          status: string
          successful_rows: number
          total_rows: number
          updated_at: string
          validation_errors: Json
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          created_by_user_id: string
          duplicate_rows?: number
          error_report_object_key?: string | null
          failed_rows?: number
          file_object_key?: string | null
          id?: string
          idempotency_hash?: string | null
          import_type?: string
          organization_id: string
          original_filename?: string | null
          status?: string
          successful_rows?: number
          total_rows?: number
          updated_at?: string
          validation_errors?: Json
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          created_by_user_id?: string
          duplicate_rows?: number
          error_report_object_key?: string | null
          failed_rows?: number
          file_object_key?: string | null
          id?: string
          idempotency_hash?: string | null
          import_type?: string
          organization_id?: string
          original_filename?: string | null
          status?: string
          successful_rows?: number
          total_rows?: number
          updated_at?: string
          validation_errors?: Json
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          connected_at: string | null
          connected_by_user_id: string | null
          connection_status: string
          created_at: string
          credential_reference: string | null
          disconnected_at: string | null
          failure_history: Json
          id: string
          last_attempted_sync_at: string | null
          last_successful_sync_at: string | null
          organization_id: string
          provider: string
          scopes_granted: string[]
          sync_delay_threshold_mins: number
          sync_policy: Json
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          connected_by_user_id?: string | null
          connection_status?: string
          created_at?: string
          credential_reference?: string | null
          disconnected_at?: string | null
          failure_history?: Json
          id?: string
          last_attempted_sync_at?: string | null
          last_successful_sync_at?: string | null
          organization_id: string
          provider: string
          scopes_granted?: string[]
          sync_delay_threshold_mins?: number
          sync_policy?: Json
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          connected_by_user_id?: string | null
          connection_status?: string
          created_at?: string
          credential_reference?: string | null
          disconnected_at?: string | null
          failure_history?: Json
          id?: string
          last_attempted_sync_at?: string | null
          last_successful_sync_at?: string | null
          organization_id?: string
          provider?: string
          scopes_granted?: string[]
          sync_delay_threshold_mins?: number
          sync_policy?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_connected_by_user_id_fkey"
            columns: ["connected_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          aging_bucket: string | null
          amount: number
          amount_paid: number
          client_id: string
          collection_priority: string
          collection_stage: string | null
          created_at: string
          currency: string
          days_overdue: number | null
          days_until_due: number | null
          dispute_active: boolean
          dispute_created_at: string | null
          dispute_reason: string | null
          due_date: string
          escalation_stage: string | null
          external_id: string | null
          id: string
          import_batch_id: string | null
          imported_at: string | null
          invoice_number: string | null
          issue_date: string | null
          last_action_taken_at: string | null
          last_successful_contact_at: string | null
          last_synced_at: string | null
          next_action_planned_at: string | null
          on_hold_reason: string | null
          organization_id: string
          paid_at: string | null
          payment_plan_active: boolean
          payment_plan_id: string | null
          priority_score: number | null
          promise_to_pay_active: boolean
          promise_to_pay_amount: number | null
          promise_to_pay_date: string | null
          remaining_balance: number
          risk_score: number | null
          source_record_id: string | null
          source_system: string | null
          state: string
          sync_run_id: string | null
          updated_at: string
        }
        Insert: {
          aging_bucket?: string | null
          amount: number
          amount_paid?: number
          client_id: string
          collection_priority?: string
          collection_stage?: string | null
          created_at?: string
          currency: string
          days_overdue?: number | null
          days_until_due?: number | null
          dispute_active?: boolean
          dispute_created_at?: string | null
          dispute_reason?: string | null
          due_date: string
          escalation_stage?: string | null
          external_id?: string | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          invoice_number?: string | null
          issue_date?: string | null
          last_action_taken_at?: string | null
          last_successful_contact_at?: string | null
          last_synced_at?: string | null
          next_action_planned_at?: string | null
          on_hold_reason?: string | null
          organization_id: string
          paid_at?: string | null
          payment_plan_active?: boolean
          payment_plan_id?: string | null
          priority_score?: number | null
          promise_to_pay_active?: boolean
          promise_to_pay_amount?: number | null
          promise_to_pay_date?: string | null
          remaining_balance: number
          risk_score?: number | null
          source_record_id?: string | null
          source_system?: string | null
          state?: string
          sync_run_id?: string | null
          updated_at?: string
        }
        Update: {
          aging_bucket?: string | null
          amount?: number
          amount_paid?: number
          client_id?: string
          collection_priority?: string
          collection_stage?: string | null
          created_at?: string
          currency?: string
          days_overdue?: number | null
          days_until_due?: number | null
          dispute_active?: boolean
          dispute_created_at?: string | null
          dispute_reason?: string | null
          due_date?: string
          escalation_stage?: string | null
          external_id?: string | null
          id?: string
          import_batch_id?: string | null
          imported_at?: string | null
          invoice_number?: string | null
          issue_date?: string | null
          last_action_taken_at?: string | null
          last_successful_contact_at?: string | null
          last_synced_at?: string | null
          next_action_planned_at?: string | null
          on_hold_reason?: string | null
          organization_id?: string
          paid_at?: string | null
          payment_plan_active?: boolean
          payment_plan_id?: string | null
          priority_score?: number | null
          promise_to_pay_active?: boolean
          promise_to_pay_amount?: number | null
          promise_to_pay_date?: string | null
          remaining_balance?: number
          risk_score?: number | null
          source_record_id?: string | null
          source_system?: string | null
          state?: string
          sync_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invitation_expires_at: string | null
          invitation_token: string | null
          invited_by_user_id: string | null
          organization_id: string
          role: string
          scoped_access_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_by_user_id?: string | null
          organization_id: string
          role: string
          scoped_access_type?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_by_user_id?: string | null
          organization_id?: string
          role?: string
          scoped_access_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_invited_by_user_id_fkey"
            columns: ["invited_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string
          id: string
          last_modified_by: string | null
          organization_id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_modified_by?: string | null
          organization_id: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_modified_by?: string | null
          organization_id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_settings_last_modified_by_fkey"
            columns: ["last_modified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          active_module_ids: string[]
          brand_tone: string
          business_hours_days: number[]
          business_hours_end: string | null
          business_hours_start: string | null
          channel_preferences: Json
          country: string
          created_at: string
          custom_tone_instructions: string | null
          default_currency: string
          display_name: string
          feature_flags: Json
          holiday_calendar: Json
          id: string
          is_demo: boolean
          legal_name: string
          regional_sending_restrictions: Json
          reply_to_address: string | null
          sender_display_name: string | null
          sender_email: string | null
          sender_verified_at: string | null
          subscription_state: string
          timezone: string
          updated_at: string
        }
        Insert: {
          active_module_ids?: string[]
          brand_tone?: string
          business_hours_days?: number[]
          business_hours_end?: string | null
          business_hours_start?: string | null
          channel_preferences?: Json
          country: string
          created_at?: string
          custom_tone_instructions?: string | null
          default_currency: string
          display_name: string
          feature_flags?: Json
          holiday_calendar?: Json
          id?: string
          is_demo?: boolean
          legal_name: string
          regional_sending_restrictions?: Json
          reply_to_address?: string | null
          sender_display_name?: string | null
          sender_email?: string | null
          sender_verified_at?: string | null
          subscription_state?: string
          timezone: string
          updated_at?: string
        }
        Update: {
          active_module_ids?: string[]
          brand_tone?: string
          business_hours_days?: number[]
          business_hours_end?: string | null
          business_hours_start?: string | null
          channel_preferences?: Json
          country?: string
          created_at?: string
          custom_tone_instructions?: string | null
          default_currency?: string
          display_name?: string
          feature_flags?: Json
          holiday_calendar?: Json
          id?: string
          is_demo?: boolean
          legal_name?: string
          regional_sending_restrictions?: Json
          reply_to_address?: string | null
          sender_display_name?: string | null
          sender_email?: string | null
          sender_verified_at?: string | null
          subscription_state?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          allocated_amount: number
          allocation_date: string
          allocation_source: string
          created_at: string
          created_by_user_id: string | null
          id: string
          invoice_id: string
          organization_id: string
          payment_id: string
          updated_at: string
        }
        Insert: {
          allocated_amount: number
          allocation_date: string
          allocation_source?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          invoice_id: string
          organization_id: string
          payment_id: string
          updated_at?: string
        }
        Update: {
          allocated_amount?: number
          allocation_date?: string
          allocation_source?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          invoice_id?: string
          organization_id?: string
          payment_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          amount_paid: number
          client_id: string
          created_at: string
          created_by_user_id: string | null
          discount_percent: number | null
          id: string
          installments: Json
          invoice_id: string
          organization_id: string
          plan_status: string
          remaining_amount: number
          settlement_offer: boolean
          total_amount: number
          updated_at: string
          workflow_adaptation: Json
        }
        Insert: {
          amount_paid?: number
          client_id: string
          created_at?: string
          created_by_user_id?: string | null
          discount_percent?: number | null
          id?: string
          installments?: Json
          invoice_id: string
          organization_id: string
          plan_status?: string
          remaining_amount: number
          settlement_offer?: boolean
          total_amount: number
          updated_at?: string
          workflow_adaptation?: Json
        }
        Update: {
          amount_paid?: number
          client_id?: string
          created_at?: string
          created_by_user_id?: string | null
          discount_percent?: number | null
          id?: string
          installments?: Json
          invoice_id?: string
          organization_id?: string
          plan_status?: string
          remaining_amount?: number
          settlement_offer?: boolean
          total_amount?: number
          updated_at?: string
          workflow_adaptation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          confidence: string
          created_at: string
          created_by_user_id: string | null
          currency: string
          id: string
          import_batch_id: string | null
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string | null
          source: string
          source_transaction_id: string | null
          sync_run_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          confidence?: string
          created_at?: string
          created_by_user_id?: string | null
          currency: string
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          organization_id: string
          payment_date: string
          payment_method?: string | null
          source: string
          source_transaction_id?: string | null
          sync_run_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          confidence?: string
          created_at?: string
          created_by_user_id?: string | null
          currency?: string
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string | null
          source?: string
          source_transaction_id?: string | null
          sync_run_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
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
          email: string
          email_verified_at: string | null
          full_name: string
          id: string
          is_internal: boolean
          last_login_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          email_verified_at?: string | null
          full_name: string
          id: string
          is_internal?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          email_verified_at?: string | null
          full_name?: string
          id?: string
          is_internal?: boolean
          last_login_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_summary: Json
          id: string
          integration_id: string
          lineage_metadata: Json
          organization_id: string
          provider: string
          records_created: number
          records_failed: number
          records_processed: number
          records_skipped: number
          records_updated: number
          started_at: string
          status: string
          sync_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_summary?: Json
          id?: string
          integration_id: string
          lineage_metadata?: Json
          organization_id: string
          provider: string
          records_created?: number
          records_failed?: number
          records_processed?: number
          records_skipped?: number
          records_updated?: number
          started_at: string
          status?: string
          sync_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_summary?: Json
          id?: string
          integration_id?: string
          lineage_metadata?: Json
          organization_id?: string
          provider?: string
          records_created?: number
          records_failed?: number
          records_processed?: number
          records_skipped?: number
          records_updated?: number
          started_at?: string
          status?: string
          sync_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_organization_id_fkey"
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
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
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
