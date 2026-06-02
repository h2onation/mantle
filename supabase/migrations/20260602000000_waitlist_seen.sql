-- Add a "seen" flag to waitlist rows so the admin can dismiss the new-signup
-- notification per-row without acting on the entry (invite/decline/add-to-beta).
-- A new signup arrives seen = false; the admin marks it seen to clear it from
-- the "new signups" badge. The row stays on the waitlist regardless of status.
-- Existing rows default to false, preserving the current badge count on deploy.
ALTER TABLE public.waitlist
    ADD COLUMN seen boolean NOT NULL DEFAULT false;
