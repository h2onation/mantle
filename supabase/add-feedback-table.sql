-- Feedback table: stores user feedback submitted via /feedback command in chat
CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  session_id uuid,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "users_insert_own_feedback" ON public.feedback
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Only admin can read feedback
CREATE POLICY "admin_read_feedback" ON public.feedback
  FOR SELECT USING (is_admin());

-- No update or delete policies — feedback is immutable
