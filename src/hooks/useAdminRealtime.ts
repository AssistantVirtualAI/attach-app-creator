import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Event = { kind: "call" | "message" | "voicemail" | "ava"; at: number };

/**
 * Centralized realtime subscription for the Planiprêt admin dashboard.
 * Listens to phone_calls / phone_messages / voicemails / ava_conversations
 * and surfaces a discreet toast + a live event counter.
 */
export function useAdminRealtime(opts?: { silent?: boolean }) {
  const [status, setStatus] = useState<"idle" | "live" | "down">("idle");
  const [lastEvent, setLastEvent] = useState<Event | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const handle = (kind: Event["kind"], label: string) => () => {
      if (!mounted.current) return;
      setLastEvent({ kind, at: Date.now() });
      setEventCount((c) => c + 1);
      if (!opts?.silent) {
        toast({ title: label, description: "Nouvelle activité en direct", duration: 2500 });
      }
    };

    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_phone_calls" }, handle("call", "Nouvel appel"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_phone_messages" }, handle("message", "Nouveau message"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_voicemails" }, handle("voicemail", "Nouveau voicemail"))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_ava_conversations" }, handle("ava", "Nouvelle conversation AVA"))
      .subscribe((s) => {
        if (!mounted.current) return;
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("down");
      });

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [opts?.silent]);

  return { status, lastEvent, eventCount };
}
