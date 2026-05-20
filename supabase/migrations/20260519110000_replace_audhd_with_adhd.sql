-- Replace 'audhd' with 'adhd' in profiles.persona_modes.
--
-- The AuDHD persona is being retired as a discrete option. Users who
-- identify with the joint autistic+ADHD experience now stack autistic +
-- adhd in their persona_modes; each delta is self-contained and the
-- model composes them. See docs/decisions.md for the design rationale.
--
-- Migration steps:
--   1. Drop the old CHECK constraint (which allowed 'audhd' but not
--      'adhd'). Must come before the data update — writing 'adhd' under
--      the old constraint would violate it and roll the migration back.
--   2. Replace 'audhd' element with 'autistic' + 'adhd' in every row
--      that has it. Preserves the user's stated dual identity rather
--      than dropping a piece. Deduplicates via array_agg(distinct).
--   3. Add a new CHECK constraint with 'adhd' replacing 'audhd'.
--   4. Update the column comment.
--
-- Beta-scope justification (per ADR-028 pattern): the affected accounts
-- are test accounts plus the owner; no production user data depends on
-- this. Safe to run.

-- Step 1: Drop the old constraint.
alter table public.profiles
  drop constraint if exists profiles_persona_modes_check;

-- Step 2: Migrate row-level data.
-- For each row where persona_modes contains 'audhd', rebuild the array
-- as (existing - 'audhd') + ['autistic', 'adhd'], then dedupe.
update public.profiles
set persona_modes = (
  select array_agg(distinct elem)
  from unnest(
    array_remove(persona_modes, 'audhd') || array['autistic', 'adhd']
  ) as elem
)
where 'audhd' = any(persona_modes);

-- Step 3: Add the new constraint with 'adhd' in place of 'audhd'.
alter table public.profiles
  add constraint profiles_persona_modes_check
    check (persona_modes is null or persona_modes <@ array['autistic', 'adhd', 'dyslexic', 'general']::text[]);

-- Step 4: Refresh column comment.
comment on column public.profiles.persona_modes is
  'AI persona voice modes (multi-select). Null and unset default to {general} as of 2026-05-19. Valid elements: autistic, adhd, dyslexic, general. "general" is exclusive — it cannot combine with any neurotype mode. AuDHD users stack autistic + adhd; the discrete audhd value was retired in migration 20260519110000.';
