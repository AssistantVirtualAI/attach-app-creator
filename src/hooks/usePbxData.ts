import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
export const usePbxQueues = () => usePbxTable('pbx_call_queues', { order: 'name', ascending: true });
export const usePbxRingGroups = () => usePbxTable('pbx_ring_groups', { order: 'name', ascending: true });
export const usePbxCallRecords = (limit = 100) => usePbxTable('pbx_call_records', { order: 'start_at', limit });
export const usePbxSmsThreads = () => usePbxTable('pbx_sms_threads', { order: 'last_message_at' });
export const usePbxIntegration = () => useQuery({
  queryKey: ['pbx', 'integration'],
  queryFn: async () => {
    const { data, error } = await supabase.from('pbx_integrations' as any).select('*').eq('organization_id', LEMTEL_ORG).maybeSingle();
    if (error) throw error;
    return data as any;
  },
});

export { LEMTEL_ORG };
