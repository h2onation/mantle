-- Convert persona_mode (single text) to persona_modes (text array) for multi-select.

-- 1. Add the new array column.
ALTER TABLE public.profiles
  ADD COLUMN persona_modes text[] DEFAULT '{autistic}';

-- 2. Migrate existing data.
UPDATE public.profiles
  SET persona_modes = ARRAY[persona_mode]
  WHERE persona_mode IS NOT NULL;

-- 3. Drop old column and its constraint.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_persona_mode_check,
  DROP COLUMN persona_mode;

-- 4. Constrain array elements to valid modes.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_persona_modes_check
    CHECK (persona_modes IS NULL OR persona_modes <@ ARRAY['autistic', 'audhd', 'dyslexic', 'general']::text[]);

COMMENT ON COLUMN public.profiles.persona_modes IS 'AI persona voice modes (multi-select). Null defaults to {autistic}. Valid elements: autistic, audhd, dyslexic, general.';
