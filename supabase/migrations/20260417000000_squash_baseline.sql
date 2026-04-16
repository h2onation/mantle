--
-- PostgreSQL database dump
--
-- Baseline squash generated 2026-04-17 from production via pg_dump 18.3
-- against PostgreSQL 17.6. This is the point-in-time snapshot of all
-- schema in the public schema — tables, indexes, triggers, functions,
-- policies, grants, constraints. All prior migrations in
-- supabase/migrations/ have been folded into this file and removed.
--
-- The `\restrict`/`\unrestrict` pg_dump 18 psql commands have been
-- stripped for compatibility with older psql clients that may run this
-- in CI or local dev. `CREATE SCHEMA public` is guarded with IF NOT
-- EXISTS since the public schema always pre-exists in fresh Postgres.
--
-- Known follow-up: the cleanup_stale_anonymous_users() function body
-- still references `manual_components` (pre-rename table name). A
-- separate migration (20260417000001_fix_cleanup_function.sql) fixes
-- this. Kept here as a pure snapshot of prod state at squash time.

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: cleanup_stale_anonymous_users(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_stale_anonymous_users() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  stale_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO stale_ids
  FROM auth.users
  WHERE is_anonymous = true
  AND created_at < now() - interval '7 days';

  IF stale_ids IS NULL OR array_length(stale_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM admin_access_logs WHERE target_user_id = ANY(stale_ids);
  DELETE FROM manual_changelog WHERE user_id = ANY(stale_ids);
  DELETE FROM manual_components WHERE user_id = ANY(stale_ids);
  DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE user_id = ANY(stale_ids)
  );
  DELETE FROM conversations WHERE user_id = ANY(stale_ids);
  DELETE FROM profiles WHERE id = ANY(stale_ids);
  DELETE FROM auth.users WHERE id = ANY(stale_ids);

  RAISE LOG 'Cleaned up % stale anonymous users', array_length(stale_ids, 1);
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_access_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_access_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    admin_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    conversation_id uuid,
    action text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: beta_allowlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beta_allowlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT beta_allowlist_email_lowercase_trimmed CHECK ((email = lower(btrim(email))))
);


--
-- Name: beta_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.beta_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    page_context text,
    feedback_text text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text,
    summary text,
    calibration_ratings text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extraction_state jsonb,
    channel text DEFAULT 'web'::text,
    processing_sms boolean DEFAULT false,
    linq_group_chat_id uuid,
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text])))
);


--
-- Name: feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    session_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: linq_group_chats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.linq_group_chats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    linq_chat_id text NOT NULL,
    owner_user_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    intro_sent boolean DEFAULT false NOT NULL,
    non_persona_participant_count integer DEFAULT 0 NOT NULL,
    messages_since_persona_spoke integer DEFAULT 0 NOT NULL,
    last_inactive_reminder_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    intro_sent_at timestamp with time zone,
    last_persona_spoke_at timestamp with time zone
);


--
-- Name: manual_changelog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_changelog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    component_id uuid NOT NULL,
    layer integer NOT NULL,
    name text,
    previous_content text NOT NULL,
    new_content text NOT NULL,
    change_description text NOT NULL,
    conversation_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT manual_changelog_layer_check CHECK ((layer = ANY (ARRAY[1, 2, 3, 4, 5])))
);


--
-- Name: manual_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.manual_entries (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    layer integer NOT NULL,
    name text,
    content text NOT NULL,
    source_message_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    summary text,
    key_words text[],
    CONSTRAINT manual_components_layer_check CHECK ((layer = ANY (ARRAY[1, 2, 3, 4, 5])))
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    is_checkpoint boolean DEFAULT false,
    checkpoint_meta jsonb,
    processing_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    extraction_snapshot jsonb,
    channel text DEFAULT 'web'::text,
    sender_phone text,
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);


--
-- Name: phone_numbers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phone_numbers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone text NOT NULL,
    verified boolean DEFAULT false,
    verification_code text,
    code_expires_at timestamp with time zone,
    linked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    linq_chat_id text,
    service_type text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    persona_mode text,
    onboarding_completed_at timestamp with time zone,
    CONSTRAINT profiles_persona_mode_check CHECK (((persona_mode IS NULL) OR (persona_mode = 'autistic'::text)))
);


--
-- Name: COLUMN profiles.persona_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.persona_mode IS 'AI persona voice mode. Currently only ''autistic''. Null defaults to autistic.';


--
-- Name: safety_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.safety_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    crisis_detected boolean DEFAULT true NOT NULL,
    persona_included_988 boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    source text,
    status text DEFAULT 'waiting'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT waitlist_email_lowercase_trimmed CHECK ((email = lower(btrim(email)))),
    CONSTRAINT waitlist_status_allowed CHECK ((status = ANY (ARRAY['waiting'::text, 'invited'::text, 'declined'::text])))
);


--
-- Name: admin_access_logs admin_access_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_access_logs
    ADD CONSTRAINT admin_access_logs_pkey PRIMARY KEY (id);


--
-- Name: beta_allowlist beta_allowlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_allowlist
    ADD CONSTRAINT beta_allowlist_email_key UNIQUE (email);


--
-- Name: beta_allowlist beta_allowlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_allowlist
    ADD CONSTRAINT beta_allowlist_pkey PRIMARY KEY (id);


--
-- Name: beta_feedback beta_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_feedback
    ADD CONSTRAINT beta_feedback_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: feedback feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_pkey PRIMARY KEY (id);


--
-- Name: linq_group_chats linq_group_chats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linq_group_chats
    ADD CONSTRAINT linq_group_chats_pkey PRIMARY KEY (id);


--
-- Name: manual_changelog manual_changelog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_changelog
    ADD CONSTRAINT manual_changelog_pkey PRIMARY KEY (id);


--
-- Name: manual_entries manual_components_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_components_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: phone_numbers phone_numbers_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_numbers
    ADD CONSTRAINT phone_numbers_phone_key UNIQUE (phone);


--
-- Name: phone_numbers phone_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_numbers
    ADD CONSTRAINT phone_numbers_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: safety_events safety_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safety_events
    ADD CONSTRAINT safety_events_pkey PRIMARY KEY (id);


--
-- Name: waitlist waitlist_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_email_key UNIQUE (email);


--
-- Name: waitlist waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.waitlist
    ADD CONSTRAINT waitlist_pkey PRIMARY KEY (id);


--
-- Name: idx_admin_access_admin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_access_admin ON public.admin_access_logs USING btree (admin_id, created_at DESC);


--
-- Name: idx_admin_access_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_admin_access_target ON public.admin_access_logs USING btree (target_user_id, created_at DESC);


--
-- Name: idx_conversations_linq_group_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_linq_group_chat_id ON public.conversations USING btree (linq_group_chat_id) WHERE (linq_group_chat_id IS NOT NULL);


--
-- Name: idx_linq_group_chats_chat_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_linq_group_chats_chat_id ON public.linq_group_chats USING btree (linq_chat_id);


--
-- Name: idx_linq_group_chats_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_linq_group_chats_owner ON public.linq_group_chats USING btree (owner_user_id);


--
-- Name: idx_manual_changelog_component; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_changelog_component ON public.manual_changelog USING btree (component_id, created_at DESC);


--
-- Name: idx_manual_changelog_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_manual_changelog_user ON public.manual_changelog USING btree (user_id, created_at DESC);


--
-- Name: idx_phone_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phone_lookup ON public.phone_numbers USING btree (phone) WHERE (verified = true);


--
-- Name: idx_safety_events_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safety_events_created_at ON public.safety_events USING btree (created_at DESC);


--
-- Name: idx_safety_events_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_safety_events_user_id ON public.safety_events USING btree (user_id);


--
-- Name: phone_numbers_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX phone_numbers_user_id_idx ON public.phone_numbers USING btree (user_id);


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: manual_entries update_manual_components_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_manual_components_updated_at BEFORE UPDATE ON public.manual_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: beta_feedback beta_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.beta_feedback
    ADD CONSTRAINT beta_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_linq_group_chat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_linq_group_chat_id_fkey FOREIGN KEY (linq_group_chat_id) REFERENCES public.linq_group_chats(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: feedback feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback
    ADD CONSTRAINT feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: linq_group_chats linq_group_chats_mantle_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.linq_group_chats
    ADD CONSTRAINT linq_group_chats_mantle_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: manual_changelog manual_changelog_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_changelog
    ADD CONSTRAINT manual_changelog_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;


--
-- Name: manual_changelog manual_changelog_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_changelog
    ADD CONSTRAINT manual_changelog_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: manual_entries manual_components_source_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_components_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.messages(id);


--
-- Name: manual_entries manual_components_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manual_entries
    ADD CONSTRAINT manual_components_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: phone_numbers phone_numbers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phone_numbers
    ADD CONSTRAINT phone_numbers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: safety_events safety_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safety_events
    ADD CONSTRAINT safety_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: safety_events safety_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.safety_events
    ADD CONSTRAINT safety_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations Users can create own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own conversations" ON public.conversations FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: manual_entries Users can create own manual entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own manual entries" ON public.manual_entries FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: messages Users can create own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create own messages" ON public.messages FOR INSERT WITH CHECK ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));


--
-- Name: conversations Users can update own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: manual_entries Users can update own manual entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own manual entries" ON public.manual_entries FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: messages Users can update own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE USING ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: conversations Users can view own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: manual_entries Users can view own manual; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own manual" ON public.manual_entries FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: messages Users can view own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid()))));


--
-- Name: profiles Users can view own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: manual_changelog Users can view their own changelog; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own changelog" ON public.manual_changelog FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: admin_access_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.admin_access_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: admin_access_logs admin_insert_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_insert_log ON public.admin_access_logs FOR INSERT WITH CHECK (public.is_admin());


--
-- Name: feedback admin_read_feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_read_feedback ON public.feedback FOR SELECT USING (public.is_admin());


--
-- Name: admin_access_logs admin_read_logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_read_logs ON public.admin_access_logs FOR SELECT USING (public.is_admin());


--
-- Name: phone_numbers admin_read_phones; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY admin_read_phones ON public.phone_numbers FOR SELECT USING (public.is_admin());


--
-- Name: beta_allowlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beta_allowlist ENABLE ROW LEVEL SECURITY;

--
-- Name: beta_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: beta_feedback beta_feedback_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY beta_feedback_owner_insert ON public.beta_feedback FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: beta_feedback beta_feedback_owner_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY beta_feedback_owner_select ON public.beta_feedback FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: linq_group_chats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.linq_group_chats ENABLE ROW LEVEL SECURITY;

--
-- Name: manual_changelog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manual_changelog ENABLE ROW LEVEL SECURITY;

--
-- Name: manual_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.manual_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: phone_numbers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

--
-- Name: phone_numbers phone_numbers_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY phone_numbers_delete_own ON public.phone_numbers FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: phone_numbers phone_numbers_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY phone_numbers_select_own ON public.phone_numbers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: phone_numbers phone_numbers_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY phone_numbers_update_own ON public.phone_numbers FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: safety_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.safety_events ENABLE ROW LEVEL SECURITY;

--
-- Name: feedback users_insert_own_feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_own_feedback ON public.feedback FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: phone_numbers users_insert_own_phone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_insert_own_phone ON public.phone_numbers FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: phone_numbers users_read_own_phone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_read_own_phone ON public.phone_numbers FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: phone_numbers users_update_own_phone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY users_update_own_phone ON public.phone_numbers FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: waitlist waitlist_anon_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY waitlist_anon_insert ON public.waitlist FOR INSERT TO anon WITH CHECK (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION cleanup_stale_anonymous_users(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cleanup_stale_anonymous_users() TO anon;
GRANT ALL ON FUNCTION public.cleanup_stale_anonymous_users() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_stale_anonymous_users() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION update_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.update_updated_at() TO anon;
GRANT ALL ON FUNCTION public.update_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.update_updated_at() TO service_role;


--
-- Name: TABLE admin_access_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.admin_access_logs TO anon;
GRANT ALL ON TABLE public.admin_access_logs TO authenticated;
GRANT ALL ON TABLE public.admin_access_logs TO service_role;


--
-- Name: TABLE beta_allowlist; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.beta_allowlist TO anon;
GRANT ALL ON TABLE public.beta_allowlist TO authenticated;
GRANT ALL ON TABLE public.beta_allowlist TO service_role;


--
-- Name: TABLE beta_feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.beta_feedback TO anon;
GRANT ALL ON TABLE public.beta_feedback TO authenticated;
GRANT ALL ON TABLE public.beta_feedback TO service_role;


--
-- Name: TABLE conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.conversations TO anon;
GRANT ALL ON TABLE public.conversations TO authenticated;
GRANT ALL ON TABLE public.conversations TO service_role;


--
-- Name: TABLE feedback; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.feedback TO anon;
GRANT ALL ON TABLE public.feedback TO authenticated;
GRANT ALL ON TABLE public.feedback TO service_role;


--
-- Name: TABLE linq_group_chats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.linq_group_chats TO anon;
GRANT ALL ON TABLE public.linq_group_chats TO authenticated;
GRANT ALL ON TABLE public.linq_group_chats TO service_role;


--
-- Name: TABLE manual_changelog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.manual_changelog TO anon;
GRANT ALL ON TABLE public.manual_changelog TO authenticated;
GRANT ALL ON TABLE public.manual_changelog TO service_role;


--
-- Name: TABLE manual_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.manual_entries TO anon;
GRANT ALL ON TABLE public.manual_entries TO authenticated;
GRANT ALL ON TABLE public.manual_entries TO service_role;


--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messages TO anon;
GRANT ALL ON TABLE public.messages TO authenticated;
GRANT ALL ON TABLE public.messages TO service_role;


--
-- Name: TABLE phone_numbers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.phone_numbers TO anon;
GRANT ALL ON TABLE public.phone_numbers TO authenticated;
GRANT ALL ON TABLE public.phone_numbers TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE safety_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.safety_events TO anon;
GRANT ALL ON TABLE public.safety_events TO authenticated;
GRANT ALL ON TABLE public.safety_events TO service_role;


--
-- Name: TABLE waitlist; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.waitlist TO anon;
GRANT ALL ON TABLE public.waitlist TO authenticated;
GRANT ALL ON TABLE public.waitlist TO service_role;


--
-- DEFAULT PRIVILEGES (Supabase-platform managed).
--
-- pg_dump captured these because prod has them applied — they're set by
-- the Supabase infra when a project is created. They require either the
-- role-being-aliased or a superuser to execute, which is true in prod
-- but NOT in local `supabase start` (the CLI migration runner isn't
-- supabase_admin). In prod, this squash is marked as already-applied so
-- these lines never re-run; in local/CI, we wrap each in a DO block
-- that swallows insufficient-privilege errors.
--
-- Effect: local envs run with whatever defaults supabase/setup-cli
-- applies; prod keeps the defaults pg_dump captured. No behavior drift
-- for end-user auth (RLS policies on every table are the real guard).

DO $$ BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping ALTER DEFAULT PRIVILEGES FOR postgres SEQUENCES (insufficient_privilege — OK in local/CI)';
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping ALTER DEFAULT PRIVILEGES FOR supabase_admin SEQUENCES (insufficient_privilege — OK in local/CI)';
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping ALTER DEFAULT PRIVILEGES FOR postgres FUNCTIONS (insufficient_privilege — OK in local/CI)';
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping ALTER DEFAULT PRIVILEGES FOR supabase_admin FUNCTIONS (insufficient_privilege — OK in local/CI)';
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping ALTER DEFAULT PRIVILEGES FOR postgres TABLES (insufficient_privilege — OK in local/CI)';
END $$;

DO $$ BEGIN
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Skipping ALTER DEFAULT PRIVILEGES FOR supabase_admin TABLES (insufficient_privilege — OK in local/CI)';
END $$;


--
-- PostgreSQL database dump complete
--

