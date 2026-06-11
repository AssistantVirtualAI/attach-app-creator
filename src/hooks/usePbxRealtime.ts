import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Subscribe to one or more PBX mirror tables and invalidate React Query on any change. */
export function usePbxRealtime(tables: string[], queryKey: any[] = ["pbx"]) {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase.channel(`pbx-rt-${tables.join("-")}`);
    tables.forEach((t) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
        qc.invalidateQueries({ queryKey });
      });
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tables.join("|"), JSON.stringify(queryKey), qc]);
}
