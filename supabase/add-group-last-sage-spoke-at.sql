ALTER TABLE public.linq_group_chats
  ADD COLUMN IF NOT EXISTS last_sage_spoke_at timestamptz;
