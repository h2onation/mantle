-- Drop the checkpoint_tuning tables — the last push-era admin dial is gone.
--
-- Under the pull model (ADR-052) the only surviving reader was cooldown_turns,
-- which paced the reflection meter's post-save VISUAL recharge — a feel
-- constant, not a safety valve. It never gated readiness (Jove's landed marker
-- is the only ready source). The dial, its admin panel, and its API route were
-- removed 2026-07-07 (founder call); the recharge pace is now the code
-- constant REFLECTION_RECHARGE_TURNS (persona-pipeline.ts, value 5 — the
-- shipped default; the prod row's 12 was tuned for the deleted push model).
-- History table goes with it: it audited edits to a dial that no longer
-- exists. Neither table holds user data.

drop table if exists checkpoint_tuning_history;
drop table if exists checkpoint_tuning;
