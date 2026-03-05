-- Helper function: checks JWT app_metadata for admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin read-only policies (additive to existing user policies)
CREATE POLICY "admin_read_profiles" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "admin_read_conversations" ON conversations
  FOR SELECT USING (is_admin());

CREATE POLICY "admin_read_messages" ON messages
  FOR SELECT USING (is_admin());

-- Audit trail table
CREATE TABLE admin_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  conversation_id uuid,
  action text NOT NULL DEFAULT 'view_conversation',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_insert_log" ON admin_access_logs
  FOR INSERT WITH CHECK (is_admin() AND admin_id = auth.uid());

CREATE POLICY "admin_read_logs" ON admin_access_logs
  FOR SELECT USING (is_admin());

CREATE INDEX idx_admin_access_target ON admin_access_logs(target_user_id);
CREATE INDEX idx_admin_access_admin ON admin_access_logs(admin_id);
