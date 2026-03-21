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
      approvals: {
        Row: {
          approval_type: string
          approver_role: string | null
          approver_user_id: string | null
          client_id: string | null
          context_shown: Json
          created_at: string
          decision_at: string | null
          edits_applied: Json | null
          expires_at: string
          id: string
          invoice_id: string | null
          organization_id: string
          outbound_message_id: string | null
          rationale_shown: string
          rejection_reason: string | null
          status: string
          updated_at: string
          workflow_action_id: string | null
        }
        Insert: {
          approval_type: string
          approver_role?: string | null
          approver_user_id?: string | null
          client_id?: string | null
          context_shown: Json
          created_at?: string
          decision_at?: string | null
          edits_applied?: Json | null
          expires_at: string
          id?: string
          invoice_id?: string | null
          organization_id: string
          outbound_message_id?: string | null
          rationale_shown: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          workflow_action_id?: string | null
        }
        Update: {
          approval_type?: string
          approver_role?: string | null
          approver_user_id?: string | null
          client_id?: string | null
          context_shown?: Json
          created_at?: string
          decision_at?: string | null
          edits_applied?: Json | null
          expires_at?: string
          id?: string
          invoice_id?: string | null
          organization_id?: string
          outbound_message_id?: string | null
          rationale_shown?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          workflow_action_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approvals_approver_user_id_fkey"
            columns: ["approver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_type: string
          actor_user_id: string | null
          after_snapshot: Json | null
          before_snapshot: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          occurred_at: string
          organization_id: string | null
          reason: string | null
          reason_code: string | null
          session_id: string | null
          source_ip: unknown
          user_agent: string | null
        }
        Insert: {
          action_type: string
          actor_type: string
          actor_user_id?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          occurred_at?: string
          organization_id?: string | null
          reason?: string | null
          reason_code?: string | null
          session_id?: string | null
          source_ip?: unknown
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          actor_type?: string
          actor_user_id?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          occurred_at?: string
          organization_id?: string | null
          reason?: string | null
          reason_code?: string | null
          session_id?: string | null
          source_ip?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
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
      communication_threads: {
        Row: {
          channel: string
          client_id: string
          created_at: string
          id: string
          latest_message_at: string | null
          latest_reply_at: string | null
          linked_invoice_ids: string[]
          organization_id: string
          primary_invoice_id: string | null
          provider_thread_id: string | null
          subject: string | null
          thread_classification: string
          thread_status: string
          updated_at: string
        }
        Insert: {
          channel: string
          client_id: string
          created_at?: string
          id?: string
          latest_message_at?: string | null
          latest_reply_at?: string | null
          linked_invoice_ids?: string[]
          organization_id: string
          primary_invoice_id?: string | null
          provider_thread_id?: string | null
          subject?: string | null
          thread_classification?: string
          thread_status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          client_id?: string
          created_at?: string
          id?: string
          latest_message_at?: string | null
          latest_reply_at?: string | null
          linked_invoice_ids?: string[]
          organization_id?: string
          primary_invoice_id?: string | null
          provider_thread_id?: string | null
          subject?: string | null
          thread_classification?: string
          thread_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_threads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_threads_primary_invoice_id_fkey"
            columns: ["primary_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_bundles: {
        Row: {
          bundle_type: string
          contents_summary: Json
          created_at: string
          expires_at: string | null
          generated_at: string
          generated_by_user_id: string | null
          id: string
          object_storage_key: string
          organization_id: string
          support_case_id: string | null
        }
        Insert: {
          bundle_type: string
          contents_summary?: Json
          created_at?: string
          expires_at?: string | null
          generated_at: string
          generated_by_user_id?: string | null
          id?: string
          object_storage_key: string
          organization_id: string
          support_case_id?: string | null
        }
        Update: {
          bundle_type?: string
          contents_summary?: Json
          created_at?: string
          expires_at?: string | null
          generated_at?: string
          generated_by_user_id?: string | null
          id?: string
          object_storage_key?: string
          organization_id?: string
          support_case_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_bundles_generated_by_user_id_fkey"
            columns: ["generated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_bundles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_bundles_support_case_id_fkey"
            columns: ["support_case_id"]
            isOneToOne: false
            referencedRelation: "support_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string
          enabled_by_default: boolean
          flag_key: string
          id: string
          rollout_percentage: number
          targeting_rules: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description: string
          enabled_by_default?: boolean
          flag_key: string
          id?: string
          rollout_percentage?: number
          targeting_rules?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string
          enabled_by_default?: boolean
          flag_key?: string
          id?: string
          rollout_percentage?: number
          targeting_rules?: Json
          updated_at?: string
        }
        Relationships: []
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
      inbound_messages: {
        Row: {
          action_outcome: string | null
          channel: string
          classification: string
          classification_confidence: number | null
          classification_model_used: string | null
          classification_prompt_version: string | null
          classified_by_user_id: string | null
          client_id: string | null
          communication_thread_id: string | null
          created_at: string
          id: string
          invoice_id: string | null
          linked_outbound_message_id: string | null
          manual_review_reason: string | null
          organization_id: string
          out_of_office_until: string | null
          promise_to_pay_date: string | null
          provider_message_id: string | null
          provider_thread_id: string | null
          raw_content: string
          received_at: string
          requires_manual_review: boolean
          sender_contact_id: string | null
          sender_email: string | null
          sender_name: string | null
          sender_phone: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          action_outcome?: string | null
          channel: string
          classification?: string
          classification_confidence?: number | null
          classification_model_used?: string | null
          classification_prompt_version?: string | null
          classified_by_user_id?: string | null
          client_id?: string | null
          communication_thread_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          linked_outbound_message_id?: string | null
          manual_review_reason?: string | null
          organization_id: string
          out_of_office_until?: string | null
          promise_to_pay_date?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          raw_content: string
          received_at: string
          requires_manual_review?: boolean
          sender_contact_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          action_outcome?: string | null
          channel?: string
          classification?: string
          classification_confidence?: number | null
          classification_model_used?: string | null
          classification_prompt_version?: string | null
          classified_by_user_id?: string | null
          client_id?: string | null
          communication_thread_id?: string | null
          created_at?: string
          id?: string
          invoice_id?: string | null
          linked_outbound_message_id?: string | null
          manual_review_reason?: string | null
          organization_id?: string
          out_of_office_until?: string | null
          promise_to_pay_date?: string | null
          provider_message_id?: string | null
          provider_thread_id?: string | null
          raw_content?: string
          received_at?: string
          requires_manual_review?: boolean
          sender_contact_id?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_messages_classified_by_user_id_fkey"
            columns: ["classified_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_communication_thread_id_fkey"
            columns: ["communication_thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_linked_outbound_message_id_fkey"
            columns: ["linked_outbound_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_messages_sender_contact_id_fkey"
            columns: ["sender_contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
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
      module_entitlements: {
        Row: {
          activated_at: string | null
          created_at: string
          deactivated_at: string | null
          deactivation_reason: string | null
          expires_at: string | null
          id: string
          module_id: string
          organization_id: string
          status: string
          subscription_id: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expires_at?: string | null
          id?: string
          module_id: string
          organization_id: string
          status?: string
          subscription_id: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          deactivated_at?: string | null
          deactivation_reason?: string | null
          expires_at?: string | null
          id?: string
          module_id?: string
          organization_id?: string
          status?: string
          subscription_id?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_entitlements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_entitlements_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string
          delivered_at: string | null
          delivery_channels: string[]
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          notification_class: string
          organization_id: string
          read_at: string | null
          suppression_key: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string
          delivered_at?: string | null
          delivery_channels?: string[]
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notification_class: string
          organization_id: string
          read_at?: string | null
          suppression_key?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string
          delivered_at?: string | null
          delivery_channels?: string[]
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          notification_class?: string
          organization_id?: string
          read_at?: string | null
          suppression_key?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
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
      outbound_messages: {
        Row: {
          ai_generation_latency_ms: number | null
          ai_model_used: string | null
          ai_policy_check_result: Json | null
          ai_prompt_version: string | null
          approval_context: Json | null
          approval_expires_at: string | null
          approval_required: boolean
          approval_status: string
          approved_at: string | null
          approved_by_user_id: string | null
          approver_user_id: string | null
          body_html: string | null
          body_text: string
          channel: string
          client_id: string
          collection_stage: string | null
          communication_thread_id: string | null
          contact_id: string | null
          created_at: string
          delivered_at: string | null
          edits_applied: Json | null
          edits_made: boolean
          failed_at: string | null
          failure_category: string | null
          failure_detail: string | null
          id: string
          idempotency_key: string
          invoice_id: string | null
          organization_id: string
          provider_message_id: string | null
          provider_response: Json | null
          rationale: string | null
          rationale_code: string | null
          retry_count: number
          retry_eligible: boolean
          send_status: string
          sent_at: string | null
          source_type: string
          subject: string | null
          template_id: string | null
          updated_at: string
          workflow_action_id: string | null
          workflow_run_id: string | null
        }
        Insert: {
          ai_generation_latency_ms?: number | null
          ai_model_used?: string | null
          ai_policy_check_result?: Json | null
          ai_prompt_version?: string | null
          approval_context?: Json | null
          approval_expires_at?: string | null
          approval_required?: boolean
          approval_status?: string
          approved_at?: string | null
          approved_by_user_id?: string | null
          approver_user_id?: string | null
          body_html?: string | null
          body_text: string
          channel: string
          client_id: string
          collection_stage?: string | null
          communication_thread_id?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          edits_applied?: Json | null
          edits_made?: boolean
          failed_at?: string | null
          failure_category?: string | null
          failure_detail?: string | null
          id?: string
          idempotency_key: string
          invoice_id?: string | null
          organization_id: string
          provider_message_id?: string | null
          provider_response?: Json | null
          rationale?: string | null
          rationale_code?: string | null
          retry_count?: number
          retry_eligible?: boolean
          send_status?: string
          sent_at?: string | null
          source_type: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
          workflow_action_id?: string | null
          workflow_run_id?: string | null
        }
        Update: {
          ai_generation_latency_ms?: number | null
          ai_model_used?: string | null
          ai_policy_check_result?: Json | null
          ai_prompt_version?: string | null
          approval_context?: Json | null
          approval_expires_at?: string | null
          approval_required?: boolean
          approval_status?: string
          approved_at?: string | null
          approved_by_user_id?: string | null
          approver_user_id?: string | null
          body_html?: string | null
          body_text?: string
          channel?: string
          client_id?: string
          collection_stage?: string | null
          communication_thread_id?: string | null
          contact_id?: string | null
          created_at?: string
          delivered_at?: string | null
          edits_applied?: Json | null
          edits_made?: boolean
          failed_at?: string | null
          failure_category?: string | null
          failure_detail?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string | null
          organization_id?: string
          provider_message_id?: string | null
          provider_response?: Json | null
          rationale?: string | null
          rationale_code?: string | null
          retry_count?: number
          retry_eligible?: boolean
          send_status?: string
          sent_at?: string | null
          source_type?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
          workflow_action_id?: string | null
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_messages_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_approver_user_id_fkey"
            columns: ["approver_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_communication_thread_id_fkey"
            columns: ["communication_thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      prompt_versions: {
        Row: {
          activated_at: string | null
          created_at: string
          created_by_user_id: string | null
          id: string
          is_active: boolean
          model_target: string
          system_prompt: string
          use_case: string
          user_prompt_template: string
          version: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_active?: boolean
          model_target: string
          system_prompt: string
          use_case: string
          user_prompt_template: string
          version: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          is_active?: boolean
          model_target?: string
          system_prompt?: string
          use_case?: string
          user_prompt_template?: string
          version?: string
        }
        Relationships: []
      }
      read_client_summary: {
        Row: {
          account_owner_name: string | null
          client_id: string
          display_name: string | null
          do_not_automate: boolean | null
          due_soon_total: number | null
          latest_reply_at: string | null
          latest_reply_classification: string | null
          next_action: string | null
          organization_id: string
          outstanding_total: number | null
          overdue_invoice_count: number | null
          overdue_total: number | null
          refreshed_at: string
          risk_score: number | null
          sensitivity_level: string | null
        }
        Insert: {
          account_owner_name?: string | null
          client_id: string
          display_name?: string | null
          do_not_automate?: boolean | null
          due_soon_total?: number | null
          latest_reply_at?: string | null
          latest_reply_classification?: string | null
          next_action?: string | null
          organization_id: string
          outstanding_total?: number | null
          overdue_invoice_count?: number | null
          overdue_total?: number | null
          refreshed_at?: string
          risk_score?: number | null
          sensitivity_level?: string | null
        }
        Update: {
          account_owner_name?: string | null
          client_id?: string
          display_name?: string | null
          do_not_automate?: boolean | null
          due_soon_total?: number | null
          latest_reply_at?: string | null
          latest_reply_classification?: string | null
          next_action?: string | null
          organization_id?: string
          outstanding_total?: number | null
          overdue_invoice_count?: number | null
          overdue_total?: number | null
          refreshed_at?: string
          risk_score?: number | null
          sensitivity_level?: string | null
        }
        Relationships: []
      }
      read_home_summary: {
        Row: {
          approvals_pending: number | null
          automation_paused: boolean | null
          due_soon_count: number | null
          due_soon_total: number | null
          high_risk_client_count: number | null
          integration_health_warnings: string[] | null
          organization_id: string
          overdue_count: number | null
          overdue_total: number | null
          refreshed_at: string
          replies_needing_attention: number | null
        }
        Insert: {
          approvals_pending?: number | null
          automation_paused?: boolean | null
          due_soon_count?: number | null
          due_soon_total?: number | null
          high_risk_client_count?: number | null
          integration_health_warnings?: string[] | null
          organization_id: string
          overdue_count?: number | null
          overdue_total?: number | null
          refreshed_at?: string
          replies_needing_attention?: number | null
        }
        Update: {
          approvals_pending?: number | null
          automation_paused?: boolean | null
          due_soon_count?: number | null
          due_soon_total?: number | null
          high_risk_client_count?: number | null
          integration_health_warnings?: string[] | null
          organization_id?: string
          overdue_count?: number | null
          overdue_total?: number | null
          refreshed_at?: string
          replies_needing_attention?: number | null
        }
        Relationships: []
      }
      read_invoice_list: {
        Row: {
          aging_bucket: string | null
          amount: number | null
          client_display_name: string | null
          collection_priority: string | null
          contact_email: string | null
          contact_name: string | null
          currency: string | null
          days_overdue: number | null
          due_date: string | null
          invoice_id: string
          invoice_number: string | null
          last_action_taken_at: string | null
          next_action_planned_at: string | null
          organization_id: string
          refreshed_at: string
          remaining_balance: number | null
          risk_score: number | null
          state: string | null
        }
        Insert: {
          aging_bucket?: string | null
          amount?: number | null
          client_display_name?: string | null
          collection_priority?: string | null
          contact_email?: string | null
          contact_name?: string | null
          currency?: string | null
          days_overdue?: number | null
          due_date?: string | null
          invoice_id: string
          invoice_number?: string | null
          last_action_taken_at?: string | null
          next_action_planned_at?: string | null
          organization_id: string
          refreshed_at?: string
          remaining_balance?: number | null
          risk_score?: number | null
          state?: string | null
        }
        Update: {
          aging_bucket?: string | null
          amount?: number | null
          client_display_name?: string | null
          collection_priority?: string | null
          contact_email?: string | null
          contact_name?: string | null
          currency?: string | null
          days_overdue?: number | null
          due_date?: string | null
          invoice_id?: string
          invoice_number?: string | null
          last_action_taken_at?: string | null
          next_action_planned_at?: string | null
          organization_id?: string
          refreshed_at?: string
          remaining_balance?: number | null
          risk_score?: number | null
          state?: string | null
        }
        Relationships: []
      }
      risk_scores: {
        Row: {
          client_id: string
          computed_at: string
          created_at: string
          explanation: string
          explanation_prompt_version: string | null
          id: string
          indicators: Json
          invoice_id: string | null
          model_used: string | null
          module_dependency: string
          organization_id: string
          score: number
          score_version: string
          updated_at: string
        }
        Insert: {
          client_id: string
          computed_at: string
          created_at?: string
          explanation: string
          explanation_prompt_version?: string | null
          id?: string
          indicators?: Json
          invoice_id?: string | null
          model_used?: string | null
          module_dependency: string
          organization_id: string
          score: number
          score_version: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          computed_at?: string
          created_at?: string
          explanation?: string
          explanation_prompt_version?: string | null
          id?: string
          indicators?: Json
          invoice_id?: string | null
          model_used?: string | null
          module_dependency?: string
          organization_id?: string
          score?: number
          score_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_scores_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_scores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_interval: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_period_ends_at: string | null
          id: string
          organization_id: string
          payment_provider: string | null
          payment_provider_subscription_id: string | null
          plan_id: string
          plan_name: string
          status: string
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
        }
        Insert: {
          billing_interval: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          id?: string
          organization_id: string
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan_id: string
          plan_name: string
          status?: string
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_period_ends_at?: string | null
          id?: string
          organization_id?: string
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan_id?: string
          plan_name?: string
          status?: string
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assigned_to_internal_user_id: string | null
          auto_attached_context: Json
          case_type: string | null
          created_at: string
          created_by_user_id: string
          description: string
          id: string
          internal_notes: string | null
          organization_id: string
          resolved_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to_internal_user_id?: string | null
          auto_attached_context?: Json
          case_type?: string | null
          created_at?: string
          created_by_user_id: string
          description: string
          id?: string
          internal_notes?: string | null
          organization_id: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to_internal_user_id?: string | null
          auto_attached_context?: Json
          case_type?: string | null
          created_at?: string
          created_by_user_id?: string
          description?: string
          id?: string
          internal_notes?: string | null
          organization_id?: string
          resolved_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      usage_records: {
        Row: {
          billing_period_end: string
          billing_period_start: string
          created_at: string
          id: string
          module_id: string
          organization_id: string
          quantity: number
          recorded_at: string
          usage_dimension: string
        }
        Insert: {
          billing_period_end: string
          billing_period_start: string
          created_at?: string
          id?: string
          module_id: string
          organization_id: string
          quantity: number
          recorded_at: string
          usage_dimension: string
        }
        Update: {
          billing_period_end?: string
          billing_period_start?: string
          created_at?: string
          id?: string
          module_id?: string
          organization_id?: string
          quantity?: number
          recorded_at?: string
          usage_dimension?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_briefs: {
        Row: {
          actions_taken_summary: Json
          created_at: string
          delivered_at: string | null
          delivered_to_user_ids: string[]
          disputes_count: number
          due_soon_total: number
          generated_at: string
          id: string
          narrative_object_key: string | null
          narrative_text: string | null
          organization_id: string
          outstanding_total: number
          overdue_movement: number
          overdue_total: number
          period_end: string
          period_start: string
          promises_to_pay_count: number
          recommended_next_steps: Json
          recovered_amount: number
        }
        Insert: {
          actions_taken_summary?: Json
          created_at?: string
          delivered_at?: string | null
          delivered_to_user_ids?: string[]
          disputes_count?: number
          due_soon_total: number
          generated_at: string
          id?: string
          narrative_object_key?: string | null
          narrative_text?: string | null
          organization_id: string
          outstanding_total: number
          overdue_movement: number
          overdue_total: number
          period_end: string
          period_start: string
          promises_to_pay_count?: number
          recommended_next_steps?: Json
          recovered_amount: number
        }
        Update: {
          actions_taken_summary?: Json
          created_at?: string
          delivered_at?: string | null
          delivered_to_user_ids?: string[]
          disputes_count?: number
          due_soon_total?: number
          generated_at?: string
          id?: string
          narrative_object_key?: string | null
          narrative_text?: string | null
          organization_id?: string
          outstanding_total?: number
          overdue_movement?: number
          overdue_total?: number
          period_end?: string
          period_start?: string
          promises_to_pay_count?: number
          recommended_next_steps?: Json
          recovered_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "weekly_briefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_actions: {
        Row: {
          action_payload: Json
          action_type: string
          cancelled_at: string | null
          cancelled_reason: string | null
          client_id: string | null
          contact_id: string | null
          created_at: string
          executed_at: string | null
          fail_reason: string | null
          id: string
          idempotency_key: string
          invoice_id: string | null
          organization_id: string
          outbound_message_id: string | null
          presend_check_passed: boolean | null
          presend_check_results: Json | null
          rationale: string
          rationale_code: string
          scheduled_for: string | null
          status: string
          updated_at: string
          workflow_definition_id: string
          workflow_run_id: string
        }
        Insert: {
          action_payload?: Json
          action_type: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          executed_at?: string | null
          fail_reason?: string | null
          id?: string
          idempotency_key: string
          invoice_id?: string | null
          organization_id: string
          outbound_message_id?: string | null
          presend_check_passed?: boolean | null
          presend_check_results?: Json | null
          rationale: string
          rationale_code: string
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          workflow_definition_id: string
          workflow_run_id: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          client_id?: string | null
          contact_id?: string | null
          created_at?: string
          executed_at?: string | null
          fail_reason?: string | null
          id?: string
          idempotency_key?: string
          invoice_id?: string | null
          organization_id?: string
          outbound_message_id?: string | null
          presend_check_passed?: boolean | null
          presend_check_results?: Json | null
          rationale?: string
          rationale_code?: string
          scheduled_for?: string | null
          status?: string
          updated_at?: string
          workflow_definition_id?: string
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_actions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "client_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_outbound_message_id_fkey"
            columns: ["outbound_message_id"]
            isOneToOne: false
            referencedRelation: "outbound_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_workflow_definition_id_fkey"
            columns: ["workflow_definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_actions_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_definitions: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string | null
          id: string
          is_default_template: boolean
          last_modified_by_user_id: string | null
          name: string
          organization_id: string
          priority: number
          published_version_id: string | null
          scope: string
          status: string
          target_client_id: string | null
          target_segment_filter: Json | null
          template_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_default_template?: boolean
          last_modified_by_user_id?: string | null
          name: string
          organization_id: string
          priority?: number
          published_version_id?: string | null
          scope?: string
          status?: string
          target_client_id?: string | null
          target_segment_filter?: Json | null
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          id?: string
          is_default_template?: boolean
          last_modified_by_user_id?: string | null
          name?: string
          organization_id?: string
          priority?: number
          published_version_id?: string | null
          scope?: string
          status?: string
          target_client_id?: string | null
          target_segment_filter?: Json | null
          template_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_definitions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_definitions_last_modified_by_user_id_fkey"
            columns: ["last_modified_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_definitions_target_client_id_fkey"
            columns: ["target_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          actions_generated: number
          client_id: string | null
          completed_at: string | null
          created_at: string
          evaluated_decision_path: Json
          fail_reason: string | null
          id: string
          invoice_id: string | null
          organization_id: string
          requires_recheck: boolean
          skip_reason: string | null
          started_at: string
          status: string
          trigger_payload: Json
          trigger_type: string
          workflow_definition_id: string
          workflow_version_id: string
        }
        Insert: {
          actions_generated?: number
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          evaluated_decision_path: Json
          fail_reason?: string | null
          id?: string
          invoice_id?: string | null
          organization_id: string
          requires_recheck?: boolean
          skip_reason?: string | null
          started_at: string
          status?: string
          trigger_payload: Json
          trigger_type: string
          workflow_definition_id: string
          workflow_version_id: string
        }
        Update: {
          actions_generated?: number
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          evaluated_decision_path?: Json
          fail_reason?: string | null
          id?: string
          invoice_id?: string | null
          organization_id?: string
          requires_recheck?: boolean
          skip_reason?: string | null
          started_at?: string
          status?: string
          trigger_payload?: Json
          trigger_type?: string
          workflow_definition_id?: string
          workflow_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_definition_id_fkey"
            columns: ["workflow_definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_workflow_version_id_fkey"
            columns: ["workflow_version_id"]
            isOneToOne: false
            referencedRelation: "workflow_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_versions: {
        Row: {
          change_summary: string | null
          created_at: string
          created_by_user_id: string | null
          definition: Json
          id: string
          organization_id: string
          published_at: string | null
          rolled_back_at: string | null
          rolled_back_reason: string | null
          simulation_result: Json | null
          version_number: number
          workflow_definition_id: string
        }
        Insert: {
          change_summary?: string | null
          created_at?: string
          created_by_user_id?: string | null
          definition: Json
          id?: string
          organization_id: string
          published_at?: string | null
          rolled_back_at?: string | null
          rolled_back_reason?: string | null
          simulation_result?: Json | null
          version_number: number
          workflow_definition_id: string
        }
        Update: {
          change_summary?: string | null
          created_at?: string
          created_by_user_id?: string | null
          definition?: Json
          id?: string
          organization_id?: string
          published_at?: string | null
          rolled_back_at?: string | null
          rolled_back_reason?: string | null
          simulation_result?: Json | null
          version_number?: number
          workflow_definition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_versions_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_versions_workflow_definition_id_fkey"
            columns: ["workflow_definition_id"]
            isOneToOne: false
            referencedRelation: "workflow_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_with_membership: {
        Args: {
          _brand_tone?: string
          _country: string
          _default_currency: string
          _display_name: string
          _is_demo?: boolean
          _legal_name: string
          _sender_display_name?: string
          _sender_email?: string
          _timezone: string
        }
        Returns: string
      }
      deactivate_module: {
        Args: { _module_id: string; _org_id: string }
        Returns: undefined
      }
      get_user_org_ids: { Args: { _user_id: string }; Returns: string[] }
      start_module_trial: {
        Args: { _module_id: string; _org_id: string; _trial_days?: number }
        Returns: string
      }
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
