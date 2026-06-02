-- Track when a waitlist row was actually invited (status flipped to 'invited'),
-- distinct from created_at (when they joined the list). Set by the invite paths
-- (PATCH status→invited, POST manual invite). Nullable, NOT backfilled — rows
-- invited before this column existed simply have no invited_at and the admin UI
-- falls back to created_at for display.
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS invited_at timestamptz;
