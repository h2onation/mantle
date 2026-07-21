-- Drop modules.icon (founder call, 2026-07-21 — removal-first follow-up to
-- ADR-054's config trim). The per-module icon key offered three glyphs, two
-- of them relics of the deleted fixed doors ("list"/"upload"), and every
-- surface fell back to the chat glyph anyway. Home cards and Manual section
-- headers now render the one shared glyph; the config field, its admin
-- input, and the icon registry are deleted with the column. Prod modules
-- table is empty, so nothing is destroyed.

alter table public.modules drop column if exists icon;
