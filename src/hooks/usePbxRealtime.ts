import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Subscribe to one or more PBX mirror tables and invalidate React Query on any change. */
export function usePbxRealtime(
  tables: string[],
  queryKey: any[] = ["pbx"],
  opts?: { throttleMs?: number; shouldInvalidate?: (payload: any) => boolean },
) {
  const qc = useQueryClient();
  const lastInvalidatedAt = useRef(0);
  useEffect(() => {
    const ch = supabase.channel(`pbx-rt-${tables.join("-")}`);
    tables.forEach((t) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, (payload) => {
        if (opts?.shouldInvalidate && !opts.shouldInvalidate(payload)) return;
        const now = Date.now();
        const throttleMs = opts?.throttleMs ?? 10_000;
        if (now - lastInvalidatedAt.current < throttleMs) return;
        lastInvalidatedAt.current = now;
        qc.invalidateQueries({ queryKey });
      });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tables.join("|"), JSON.stringify(queryKey), qc, opts?.throttleMs, opts?.shouldInvalidate]);
}
