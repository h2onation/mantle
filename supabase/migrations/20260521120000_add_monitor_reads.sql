-- Phase 0 shadow monitor: structured per-turn alliance reads.
--
-- The monitor is a Haiku pre-call introduced in Phase 0 of the two-layer
-- engine plan (see docs/reference/two-layer-engine-evaluation.md). It runs
-- alongside extraction on every web turn and writes a structured read of
-- the relationship — bond holding, task agreed, scope status, rupture
-- type, sliding-window direction.
--
-- This table is internal observability. Phase 0 does NOT gate any behavior
-- on these reads. We collect a week's worth of data, eyeball 20-30
-- transcripts against the structured reads, and decide whether to promote
-- the monitor onto the critical path. If we don't, drop this table; if we
-- do, the data lives here while we build the gate.

CREATE TABLE IF NOT EXISTS public.monitor_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Nullable because the monitor fires on the user-message turn, before
    -- Jove's response row exists in messages. We backfill once we know the
    -- assistant message id; for now this is the user message that
    -- triggered the read.
    triggering_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,

    -- The structured read. CHECK constraints mirror the enum types in
    -- src/lib/persona/monitor.ts. Keep these in sync — adding a new value
    -- requires both a code change AND a new migration to relax the check.
    bond_holding BOOLEAN NOT NULL,
    task_agreed BOOLEAN NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('in_scope', 'drifting', 'out_of_scope')),
    rupture TEXT NOT NULL CHECK (rupture IN ('none', 'withdrawal', 'confrontation')),
    direction TEXT NOT NULL CHECK (direction IN ('steadying', 'drifting', 'sinking')),
    reason TEXT,

    -- Telemetry alongside the read.
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    latency_ms INTEGER,
    turn_index INTEGER,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Common queries: "show me all reads from this conversation in order"
-- and "show me every direction=sinking read this week."
CREATE INDEX IF NOT EXISTS idx_monitor_reads_conversation
    ON public.monitor_reads(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monitor_reads_direction
    ON public.monitor_reads(direction, created_at DESC);

ALTER TABLE public.monitor_reads ENABLE ROW LEVEL SECURITY;

-- Admins read everything; nobody else has access. No INSERT/UPDATE policy
-- because writes only flow through the admin client (service role bypasses
-- RLS). End users never see this table.
DROP POLICY IF EXISTS admin_read_monitor_reads ON public.monitor_reads;
CREATE POLICY admin_read_monitor_reads ON public.monitor_reads
    FOR SELECT USING (public.is_admin());

COMMENT ON TABLE public.monitor_reads IS
    'Phase 0 shadow monitor: per-turn alliance reads. Log-only; not gating behavior. See docs/reference/two-layer-engine-evaluation.md.';
