import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const LEMTEL_ORG = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

function usePbxTable<T = any>(table: string, opts?: { order?: string; ascending?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ['pbx', table, opts],
    queryFn: async () => {
      let q = supabase.from(table as any).select('*').eq('organization_id', LEMTEL_ORG);
      if (opts?.order) q = q.order(opts.order, { ascending: opts.ascending ?? false });
      if (opts?.limit) q = q.limit(opts.limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as T[];
    },
  });
}

export const usePbxExtensions = () => usePbxTable('pbx_extensions', { order: 'extension', ascending: true });
export const usePbxDevices = () => usePbxTable('pbx_devices', { order: 'created_at' });
export const usePbxIvrs = () => usePbxTable('pbx_ivrs', { order: 'name', ascending: true });
export const usePbxIvrOptions = (ivrId: string | null) => useQuery({
  queryKey: ['pbx', 'pbx_ivr_options', ivrId],
  enabled: !!ivrId,
  queryFn: async () => {
    const { data, error } = await supabase.from('pbx_ivr_options' as any)
      .select('*').eq('ivr_id', ivrId).order('sort_order', { ascending: true });
    if (error) throw error;
    return data || [];
  },
});
export const usePbxQueues = () => usePbxTable('pbx_call_queues', { order: 'name', ascending: true });
export const usePbxRingGroups = () => usePbxTable('pbx_ring_groups', { order: 'name', ascending: true });
export const usePbxCallRecords = (limit = 100) => usePbxTable('pbx_call_records', { order: 'start_at', limit });
export const usePbxSmsThreads = () => usePbxTable('pbx_sms_threads', { order: 'last_message_at' });
export const usePbxSmsMessages = (threadId: string | null) => useQuery({
  queryKey: ['pbx', 'pbx_sms_messages', threadId],
  enabled: !!threadId,
  queryFn: async () => {
    const { data, error } = await supabase.from('pbx_sms_messages' as any)
      .select('*').eq('thread_id', threadId).order('sent_at', { ascending: true });
    if (error) throw error;
    return data || [];
  },
});
export const usePbxSoftphoneUsers = () => usePbxTable('pbx_softphone_users', { order: 'extension', ascending: true });
export const usePbxPhoneNumberAssignments = () => usePbxTable('pbx_phone_number_assignments', { order: 'created_at' });
export const usePbxAgents = () => useQuery({
  queryKey: ['pbx', 'agents'],
  queryFn: async () => {
    const { data, error } = await supabase.from('agents').select('*').eq('organization_id', LEMTEL_ORG).order('name');
    if (error) throw error;
    return data || [];
  },
});
export const usePbxClients = () => useQuery({
  queryKey: ['pbx', 'clients'],
  queryFn: async () => {
    const { data, error } = await supabase.from('clients').select('*').eq('organization_id', LEMTEL_ORG).order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
});
export const usePbxPhoneNumbers = () => useQuery({
  queryKey: ['pbx', 'phone_numbers'],
  queryFn: async () => {
    const { data, error } = await supabase.from('phone_numbers').select('*').eq('organization_id', LEMTEL_ORG);
    if (error) throw error;
    return data || [];
  },
});

export const usePbxIntegration = () => useQuery({
  queryKey: ['pbx', 'integration'],
  queryFn: async () => {
    const { data, error } = await supabase.from('pbx_integrations' as any)
      .select('*').eq('organization_id', LEMTEL_ORG).maybeSingle();
    if (error) throw error;
    return data as any;
  },
});

/** Toggle mock_mode on/off in pbx_integrations.config */
export function usePbxMockModeToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: integRaw, error: e1 } = await supabase
        .from('pbx_integrations' as any)
        .select('id, config')
        .eq('organization_id', LEMTEL_ORG)
        .maybeSingle();
      if (e1) throw e1;
      const integ = integRaw as { id?: string; config?: Record<string, unknown> } | null;
      const nextConfig = { ...(integ?.config || {}), mock_mode: enabled };
      if (integ?.id) {
        const { error } = await supabase.from('pbx_integrations' as any)
          .update({ config: nextConfig }).eq('id', integ.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pbx_integrations' as any).insert({
          organization_id: LEMTEL_ORG, provider: 'fusionpbx', config: nextConfig, status: 'pending',
        });
        if (error) throw error;
      }
      return enabled;
    },
    onSuccess: (enabled) => {
      qc.invalidateQueries({ queryKey: ['pbx', 'integration'] });
      toast.success(`Mock mode ${enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to toggle mock mode'),
  });
}

/** Manual "Refresh from PBX" — invokes fusionpbx-proxy and re-fetches affected tables. */
export function usePbxSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kind: 'cdr' | 'config' | 'devices' | 'ivr-queues' | 'all') => {
      const action = kind === 'cdr' ? 'sync-cdrs' : 'sync-all';
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action, organization_id: LEMTEL_ORG },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      return data;
    },
    onSuccess: (_d, kind) => {
      qc.invalidateQueries({ queryKey: ['pbx'] });
      toast.success(`Synced ${kind} from PBX`);
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Sync failed. See audit logs for details.');
    },
  });
}

/** Live SIP registrations from FusionPBX (polled). */
export function usePbxRegistrations(intervalMs = 30000) {
  return useQuery({
    queryKey: ['pbx', 'registrations'],
    refetchInterval: intervalMs,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'list-registrations', organization_id: LEMTEL_ORG },
      });
      if (error) return [];
      return ((data as any)?.data ?? []) as any[];
    },
  });
}

/** Ping FusionPBX directly (Test Connection button). */
export function usePbxPing() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'ping', organization_id: LEMTEL_ORG },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      return data as { status: string; latency_ms: number; extensions_count: number };
    },
    onSuccess: (d) => toast.success(`PBX OK — ${d.extensions_count} ext, ${d.latency_ms}ms`),
    onError: (e: any) => toast.error(e?.message || 'PBX ping failed'),
  });
}

export { LEMTEL_ORG };
