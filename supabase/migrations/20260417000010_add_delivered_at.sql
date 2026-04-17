-- Add a delivered_at timestamp to messaging_events so the Sendblue outbound
-- status webhook can record when a message actually reached the recipient
-- (as opposed to our send API call returning QUEUED).
--
-- Set only when the outbound status callback transitions to DELIVERED —
-- stays null for QUEUED/SENT/FAILED and for all inbound rows.
--
-- Partial index on (delivered_at desc) speeds up "delivery latency"
-- analytics queries that will look at non-null deliveries ordered by
-- recency. Small write-path cost, real future-read benefit.

alter table public.messaging_events
  add column if not exists delivered_at timestamptz;

create index if not exists messaging_events_delivered_at_idx
  on public.messaging_events (delivered_at desc)
  where delivered_at is not null;
