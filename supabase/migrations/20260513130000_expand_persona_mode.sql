-- Expand persona_mode to support multiple voice modes.
-- Previously only 'autistic' was allowed; now 'general' is also valid.
-- New modes are added by appending to this constraint.
ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_persona_mode_check,
  ADD CONSTRAINT profiles_persona_mode_check
    CHECK (persona_mode IS NULL OR persona_mode IN ('autistic', 'general'));

COMMENT ON COLUMN public.profiles.persona_mode IS 'AI persona voice mode. Null defaults to autistic. Valid: autistic, general.';
