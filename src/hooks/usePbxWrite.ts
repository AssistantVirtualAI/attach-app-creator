import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PbxWriteArgs {
  organizationId: string;
  clientId?: string;
  action: string;
  params?: Record<string, unknown>;
  mirror?: { table: string; row: Record<string, unknown>; onConflict?: string };
  objectType?: string;
  objectPbxUuid?: string;
}

/**
 * Unified mutation router for FusionPBX writes. Goes through the `pbx-write`
 * edge function which enforces RBAC, forwards to fusionpbx-proxy, upserts the
 * Supabase mirror, and writes an audit log entry.
 */
export function usePbxWrite(opts?: { invalidate?: (string | unknown[])[]; successMessage?: string }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: PbxWriteArgs) => {
      const { data, error } = await supabase.functions.invoke('pbx-write', { body: args });
      if (error) throw error;
      if ((data as any)?.ok === false) {
        throw new Error((data as any)?.detail?.message || (data as any)?.error || 'pbx-write failed');
      }
      return data as { ok: true; proxy: unknown; mirror: unknown };
    },
    onSuccess: () => {
      (opts?.invalidate || [['pbx']]).forEach((key) =>
        qc.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] }),
      );
      if (opts?.successMessage) toast.success(opts.successMessage);
    },
    onError: (e: any) => toast.error(e?.message || 'PBX write failed'),
  });
}
