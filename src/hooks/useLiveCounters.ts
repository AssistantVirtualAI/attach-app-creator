import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";

export type LiveCounterKey = "activeCalls" | "unreadVoicemail" | "alerts" | "handoffs";

export type LiveCounters = Record<LiveCounterKey, number>;

const ZERO: LiveCounters = { activeCalls: 0, unreadVoicemail: 0, alerts: 0, handoffs: 0 };

/**
 * Cockpit live counters — drives sidebar badges and KPI live indicators.
 *
 * Phase 2: returns safe zero values plus best-effort reads from existing tables
 * the user already has access to (RLS-scoped). Realtime subscriptions are
 * wired in Phase 5 (`telecom_live_calls`, alert feeds) without changing this
 * hook's public shape.
 */
export function useLiveCounters(): LiveCounters & { isReady: boolean } {
  const { selectedOrgId } = useOrganization();
  const [counters, setCounters] = useState<LiveCounters>(ZERO);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!selectedOrgId) {
      setCounters(ZERO);
      setIsReady(true);
      return;
    }

    const load = async () => {
      try {
        const [live, vm, alerts, handoffs] = await Promise.all([
          supabase
            .from("telecom_live_calls")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", selectedOrgId),
          supabase
            .from("pbx_voicemails")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", selectedOrgId)
            .is("read_at", null),
          supabase
            .from("alert_notifications")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", selectedOrgId)
            .is("read_at", null),
          supabase
            .from("handoff_requests")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", selectedOrgId)
            .eq("status", "pending"),
        ]);
        if (cancelled) return;
        setCounters({
          activeCalls: live.count ?? 0,
          unreadVoicemail: vm.count ?? 0,
          alerts: alerts.count ?? 0,
          handoffs: handoffs.count ?? 0,
        });
      } catch {
        if (!cancelled) setCounters(ZERO);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    };

    load();
    const t = setInterval(load, 60_000);
    const ch = supabase
      .channel(`live-counters-${selectedOrgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "telecom_live_calls", filter: `organization_id=eq.${selectedOrgId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "pbx_voicemails", filter: `organization_id=eq.${selectedOrgId}` }, load)
      .subscribe();
    return () => {
      cancelled = true;
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [selectedOrgId]);

  return { ...counters, isReady };
}

export default useLiveCounters;
