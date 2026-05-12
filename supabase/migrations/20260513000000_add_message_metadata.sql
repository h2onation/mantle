-- Generic metadata column on messages for extensible per-message flags.
-- First use: { "chip_response": true } for guided-intake quick-reply taps.
ALTER TABLE public.messages
ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
