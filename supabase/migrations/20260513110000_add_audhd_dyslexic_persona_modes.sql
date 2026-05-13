-- Add audhd and dyslexic persona modes.
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_persona_mode_check,
  ADD CONSTRAINT profiles_persona_mode_check
    CHECK (persona_mode IS NULL OR persona_mode IN ('autistic', 'audhd', 'dyslexic', 'general'));

COMMENT ON COLUMN public.profiles.persona_mode IS 'AI persona voice mode. Null defaults to autistic. Valid: autistic, audhd, dyslexic, general.';
