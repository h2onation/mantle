-- The admin Character voice override (`rebuilt_character`) was replaced by the
-- whole-prompt conductor override (`conductor_prompt`) on 2026-07-06, when the
-- rebuilt/legacy voice worlds were retired and the conductor became the sole
-- editable 1:1 voice. The reader (getVoiceOverrides) ignores unknown keys, so
-- this is pure cleanup: drop the orphaned row. History rows are kept — the
-- persona_voice_override_history table is an audit log.
--
-- No new schema: `conductor_prompt` is just a new key value in the existing
-- persona_voice_overrides table, written on first save from the admin page.

delete from persona_voice_overrides where key = 'rebuilt_character';
