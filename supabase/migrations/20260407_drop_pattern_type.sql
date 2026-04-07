-- Drop the pattern feature.
--
-- Before this migration, manual_components rows were tagged as either
-- 'component' (one per layer, narrative) or 'pattern' (many per layer,
-- structured). After this migration, every row is just an "entry" — Sage
-- writes to the manual whenever it has something worth writing, and the
-- classifier only decides which of the five layers an entry belongs in.
--
-- No data migration needed: there is no real user data yet.

-- manual_components: drop unique indexes that depended on the type column,
-- then drop the column itself.
drop index if exists public.unique_component_per_layer;
drop index if exists public.unique_pattern_name_per_layer;

alter table public.manual_components
  drop constraint if exists manual_components_type_check;

alter table public.manual_components
  drop column if exists type;

-- manual_changelog: same column, no dependent indexes.
alter table public.manual_changelog
  drop constraint if exists manual_changelog_type_check;

alter table public.manual_changelog
  drop column if exists type;
