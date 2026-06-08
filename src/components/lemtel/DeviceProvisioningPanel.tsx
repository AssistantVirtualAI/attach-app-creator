import { useEffect, useRef, useState } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Circle, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LEMTEL_ORG } from '@/hooks/usePbxData';
import { toast } from 'sonner';

type StepStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped';

interface Step {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
}

interface Props {
  mac: string;
  extension?: string;
  createParams: Record<string, any>;
  onDone: (deviceUuid: string | null) => void;
}

export function DeviceProvisioningPanel({ mac, extension, createParams, onDone }: Props) {
  const [steps, setSteps] = useState<Step[]>([
    { id: 'validate', label: 'Validate input', status: 'success' },
    { id: 'create', label: 'Create device in FusionPBX', status: 'pending' },
    { id: 'assign', label: 'Assign extension', status: extension ? 'pending' : 'skipped' },
    { id: 'register', label: 'Wait for SIP registration', status: 'pending' },
    { id: 'sync', label: 'Sync local cache', status: 'pending' },
  ]);
  const [log, setLog] = useState<string[]>([]);
  const startedRef = useRef(false);
  const setStep = (id: string, patch: Partial<Step>) =>
    setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const append = (line: string) => setLog((l) => [...l, `[${new Date().toLocaleTimeString()}] ${line}`]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      let deviceUuid: string | null = null;
      // 1. create
      setStep('create', { status: 'running' });
      append(`create-device mac=${mac}`);
      try {
        const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
          body: { organization_id: LEMTEL_ORG, action: 'create-device', params: createParams },
        });
        if (error) throw error;
        if (data?.ok === false) throw new Error(data?.message || 'FusionPBX rejected the device');
        deviceUuid = data?.data?.uuid || data?.device_uuid || null;
        setStep('create', { status: 'success', message: deviceUuid ? `uuid ${deviceUuid.slice(0, 8)}…` : 'created' });
        append(`✓ created`);
      } catch (e: any) {
        setStep('create', { status: 'error', message: e.message });
        append(`✗ create failed: ${e.message}`);
        onDone(null);
        return;
      }

      // 2. assign extension (already in createParams via device_user_*; this step verifies)
      if (extension) {
        setStep('assign', { status: 'success', message: `→ ext ${extension}` });
        append(`✓ extension ${extension} linked`);
      }

      // 3. registration polling (60s)
      setStep('register', { status: 'running' });
      append(`polling registrations every 3s…`);
      let registered = false;
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        try {
          const { data } = await supabase.functions.invoke('fusionpbx-proxy', {
            body: { organization_id: LEMTEL_ORG, action: 'get-registrations' },
          });
          const list = (data?.data || []) as any[];
          const match = list.find((r) =>
            (extension && String(r.user || r.aor || '').startsWith(`${extension}@`)) ||
            (mac && String(r.agent || r.user_agent || '').toLowerCase().includes(mac.slice(-6))),
          );
          if (match) {
            registered = true;
            setStep('register', {
              status: 'success',
              message: `${match.network_ip || match.contact || 'registered'}`,
            });
            append(`✓ registered from ${match.network_ip || '?'}`);
            break;
          }
        } catch (e: any) {
          append(`! registration check error: ${e.message}`);
        }
      }
      if (!registered) {
        setStep('register', { status: 'error', message: 'No SIP registration after 60s (phone may need provisioning URL)' });
        append(`✗ not registered within 60s`);
      }

      // 4. sync
      setStep('sync', { status: 'running' });
      try {
        await supabase.functions.invoke('realtime-sync', {
          body: { organizationId: LEMTEL_ORG, kind: 'devices' },
        });
        setStep('sync', { status: 'success' });
        append(`✓ local cache synced`);
      } catch (e: any) {
        setStep('sync', { status: 'error', message: e.message });
        append(`✗ sync failed: ${e.message}`);
      }
      onDone(deviceUuid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLog = () => {
    navigator.clipboard.writeText(log.join('\n'));
    toast.success('Log copied');
  };

  return (
    <div className="space-y-3 border rounded-md p-3 bg-muted/30">
      <div className="text-sm font-medium">Provisioning status</div>
      <ul className="space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-sm">
            <StepIcon status={s.status} />
            <span className="flex-1">{s.label}</span>
            {s.message && (
              <Badge variant={s.status === 'error' ? 'destructive' : 'outline'} className="text-xs">
                {s.message}
              </Badge>
            )}
          </li>
        ))}
      </ul>
      <div className="max-h-32 overflow-auto rounded bg-background border p-2 text-xs font-mono">
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={copyLog}><Copy className="w-3 h-3 mr-1" /> Copy log</Button>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/org/lemtel/telephony/qa" target="_blank"><ExternalLink className="w-3 h-3 mr-1" /> QA logs</Link>
        </Button>
      </div>
    </div>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'running') return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
  if (status === 'success') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (status === 'error') return <AlertTriangle className="w-4 h-4 text-destructive" />;
  if (status === 'skipped') return <Circle className="w-4 h-4 text-muted-foreground" />;
  return <Circle className="w-4 h-4 text-muted-foreground" />;
}
