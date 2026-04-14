"use client";

import { useCallback, useState } from "react";
import type { ManualComponent } from "@/lib/types";
import type { WaitlistRow, WaitlistStatus } from "@/components/admin/WaitlistTab";
import type { BetaFeedbackRow } from "@/components/admin/BetaFeedbackTab";
import type { BetaAllowlistRow } from "@/components/admin/BetaAllowlistTab";

export interface AdminUser {
  id: string;
  display_name: string | null;
  email: string;
  conversation_count: number;
  component_count: number;
  is_anonymous: boolean;
  created_at: string;
  last_active: string | null;
  last_conversation_at: string | null;
}

export interface AdminConversation {
  id: string;
  status: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface AdminMessage {
  id: string;
  role: string;
  content: string;
  is_checkpoint: boolean;
  checkpoint_meta: Record<string, unknown> | null;
  processing_text: string | null;
  created_at: string;
  extraction_snapshot: Record<string, unknown> | null;
}

export interface AdminFeedbackItem {
  id: string;
  user_email: string;
  message: string;
  session_id: string | null;
  created_at: string;
}

export function useAdminData() {
  // Core
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Profile
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userConversations, setUserConversations] = useState<AdminConversation[]>([]);
  const [userManual, setUserManual] = useState<ManualComponent[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<AdminMessage[]>([]);
  const [extractionState, setExtractionState] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Beta
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [waitlistLoaded, setWaitlistLoaded] = useState(false);
  const [allowlist, setAllowlist] = useState<BetaAllowlistRow[]>([]);
  const [allowlistLoaded, setAllowlistLoaded] = useState(false);

  // Feedback
  const [betaFeedback, setBetaFeedback] = useState<BetaFeedbackRow[]>([]);
  const [betaFeedbackUnreadCount, setBetaFeedbackUnreadCount] = useState(0);
  const [betaFeedbackLoaded, setBetaFeedbackLoaded] = useState(false);
  const [userFeedback, setUserFeedback] = useState<AdminFeedbackItem[]>([]);
  const [userFeedbackLoaded, setUserFeedbackLoaded] = useState(false);

  const loadUsers = useCallback(async () => {
    if (usersLoaded) return;
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const data = await res.json();
      setUsers(data.users || []);
      setUsersLoaded(true);
    } catch (err) {
      console.error("[admin] load users failed:", err);
    }
  }, [usersLoaded]);

  const loadWaitlist = useCallback(async () => {
    if (waitlistLoaded) return;
    try {
      const res = await fetch("/api/admin/waitlist");
      if (!res.ok) return;
      const data = await res.json();
      setWaitlist(data.items || []);
      setWaitlistLoaded(true);
    } catch (err) {
      console.error("[admin] load waitlist failed:", err);
    }
  }, [waitlistLoaded]);

  const loadAllowlist = useCallback(async (force = false) => {
    if (allowlistLoaded && !force) return;
    try {
      const res = await fetch("/api/admin/beta-allowlist");
      if (!res.ok) return;
      const data = await res.json();
      setAllowlist(data.items || []);
      setAllowlistLoaded(true);
    } catch (err) {
      console.error("[admin] load allowlist failed:", err);
    }
  }, [allowlistLoaded]);

  const loadBetaFeedback = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/beta-feedback");
      if (!res.ok) return;
      const data = await res.json();
      setBetaFeedback(data.items || []);
      setBetaFeedbackUnreadCount(data.unread_count || 0);
      setBetaFeedbackLoaded(true);
    } catch (err) {
      console.error("[admin] load beta feedback failed:", err);
    }
  }, []);

  const loadUserFeedback = useCallback(async () => {
    if (userFeedbackLoaded) return;
    try {
      const res = await fetch("/api/admin/feedback");
      if (!res.ok) return;
      const data = await res.json();
      setUserFeedback(data.feedback || []);
      setUserFeedbackLoaded(true);
    } catch (err) {
      console.error("[admin] load user feedback failed:", err);
    }
  }, [userFeedbackLoaded]);

  const openUserProfile = useCallback(async (user: AdminUser) => {
    setSelectedUser(user);
    setSelectedConversation(null);
    setConversationMessages([]);
    setExtractionState(null);
    setUserConversations([]);
    setUserManual([]);
    setProfileLoading(true);
    try {
      const [convRes, manualRes] = await Promise.all([
        fetch("/api/admin/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        }),
        fetch("/api/admin/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        }),
      ]);
      if (convRes.ok) {
        const d = await convRes.json();
        setUserConversations(d.conversations || []);
      }
      if (manualRes.ok) {
        const d = await manualRes.json();
        setUserManual(d.components || []);
      }
    } catch (err) {
      console.error("[admin] open profile failed:", err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const closeUserProfile = useCallback(() => {
    setSelectedUser(null);
    setSelectedConversation(null);
    setConversationMessages([]);
    setExtractionState(null);
    setUserConversations([]);
    setUserManual([]);
  }, []);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    setSelectedConversation(conversationId);
    setProfileLoading(true);
    try {
      const res = await fetch("/api/admin/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setConversationMessages(data.messages || []);
      setExtractionState(data.extractionState || null);
    } catch (err) {
      console.error("[admin] load messages failed:", err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const closeConversation = useCallback(() => {
    setSelectedConversation(null);
    setConversationMessages([]);
    setExtractionState(null);
  }, []);

  const changeWaitlistStatus = useCallback(async (id: string, status: WaitlistStatus) => {
    const res = await fetch("/api/admin/waitlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) throw new Error("Failed to update waitlist status");
    setWaitlist((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
  }, []);

  const addToBeta = useCallback(
    async (email: string, waitlistId?: string): Promise<"added" | "already_exists"> => {
      const res = await fetch("/api/admin/beta-allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, waitlist_id: waitlistId }),
      });
      if (!res.ok) throw new Error("Failed to add to beta");
      const data = await res.json();
      if (data.result === "added" && waitlistId) {
        setWaitlist((prev) =>
          prev.map((row) =>
            row.id === waitlistId ? { ...row, status: "invited" as const } : row
          )
        );
      }
      if (data.result === "added") {
        await loadAllowlist(true);
      }
      return data.result;
    },
    [loadAllowlist]
  );

  const removeFromAllowlist = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/beta-allowlist?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to remove from allowlist");
    setAllowlist((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const markBetaFeedbackRead = useCallback(async (id: string) => {
    const res = await fetch("/api/admin/beta-feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    setBetaFeedback((prev) =>
      prev.map((row) => (row.id === id ? { ...row, is_read: true } : row))
    );
    setBetaFeedbackUnreadCount((n) => Math.max(0, n - 1));
  }, []);

  return {
    // state
    users,
    usersLoaded,
    selectedUser,
    userConversations,
    userManual,
    selectedConversation,
    conversationMessages,
    extractionState,
    profileLoading,
    waitlist,
    waitlistLoaded,
    allowlist,
    allowlistLoaded,
    betaFeedback,
    betaFeedbackUnreadCount,
    betaFeedbackLoaded,
    userFeedback,
    userFeedbackLoaded,
    // actions
    loadUsers,
    loadWaitlist,
    loadAllowlist,
    loadBetaFeedback,
    loadUserFeedback,
    openUserProfile,
    closeUserProfile,
    loadConversationMessages,
    closeConversation,
    changeWaitlistStatus,
    addToBeta,
    removeFromAllowlist,
    markBetaFeedbackRead,
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
