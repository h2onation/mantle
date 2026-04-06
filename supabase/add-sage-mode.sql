-- Add sage_mode column to profiles for swappable Sage voice modes.
-- First mode is 'autistic' (the only mode shipping in PR1).
-- Nullable; null is treated as 'autistic' until additional modes are added.
--
-- Run via the Supabase dashboard SQL editor.

alter table public.profiles
  add column if not exists sage_mode text
  check (sage_mode is null or sage_mode in ('autistic'));

comment on column public.profiles.sage_mode is
  'Sage voice mode. Currently only ''autistic''. Null defaults to autistic.';
