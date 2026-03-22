-- Seed incident control feature flags so they can be toggled via update_feature_flag RPC.
-- These flags are global (no organization_id) and control outbound send channels.
-- Uses INSERT ... ON CONFLICT DO NOTHING to be idempotent.

INSERT INTO public.feature_flags (flag_key, description, enabled_by_default, rollout_percentage)
VALUES
  ('incident:global_send_shutdown',    'Stop ALL outbound sends across all tenants', FALSE, 0),
  ('incident:email_channel_shutdown',  'Stop email sends globally',                  FALSE, 0),
  ('incident:whatsapp_channel_shutdown','Stop WhatsApp sends globally',              FALSE, 0)
ON CONFLICT (flag_key) DO NOTHING;
