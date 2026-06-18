import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, ChevronDown, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ProviderId = 'twilio' | 'telnyx' | 'skyetel' | 'voipms';

interface FieldDef { key: string; label: string; secret: boolean; placeholder?: string }
interface ProviderDef {
  id: ProviderId;
  name: string;
  emoji: string;
  description: string;
  fields: FieldDef[];
  guide: { title: string; steps: string[]; url: string };
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'twilio',
    name: 'Twilio',
    emoji: '☁️',
    description: 'Voice, SMS and programmable telephony.',
    fields: [
      { key: 'account_sid', label: 'Account SID', secret: false, placeholder: 'ACxxxxxxxx…' },
      { key: 'auth_token', label: 'Auth Token', secret: true },
      { key: 'api_key_sid', label: 'API Key SID (optional)', secret: false, placeholder: 'SKxxxxxxxx…' },
      { key: 'api_key_secret', label: 'API Key Secret (optional)', secret: true },
      { key: 'from_number', label: 'Default From Number', secret: false, placeholder: '+15551234567' },
    ],
    guide: {
      title: 'How to get your Twilio credentials',
      url: 'https://console.twilio.com/',
      steps: [
        'Log in to console.twilio.com and select your project.',
        'On the dashboard, copy your Account SID and Auth Token from "Account Info".',
        'For better security, go to Account → API keys & tokens → Create API key. Save the SID and Secret immediately (the secret is shown only once).',
        'Go to Phone Numbers → Manage → Active numbers, pick a number and paste it here in E.164 format (+15551234567).',
      ],
    },
  },
  {
    id: 'telnyx',
    name: 'Telnyx',
    emoji: '📡',
    description: 'SIP trunking, numbers and messaging.',
    fields: [
      { key: 'api_key', label: 'API Key (v2)', secret: true, placeholder: 'KEY...' },
      { key: 'messaging_profile_id', label: 'Messaging Profile ID', secret: false },
      { key: 'connection_id', label: 'Connection ID', secret: false },
      { key: 'from_number', label: 'Default From Number', secret: false, placeholder: '+15551234567' },
    ],
    guide: {
      title: 'How to get your Telnyx credentials',
      url: 'https://portal.telnyx.com/',
      steps: [
        'Log in to portal.telnyx.com.',
        'Go to Account → API Keys → Create API Key. Copy the v2 key (starts with "KEY").',
        'Go to Messaging → Messaging Profiles, open or create a profile and copy its UUID.',
        'Go to Voice → SIP Trunking → Connections, open your trunk and copy the Connection ID.',
        'Buy or pick a number in Numbers → My Numbers and paste it in E.164 format.',
      ],
    },
  },
  {
    id: 'skyetel',
    name: 'Skyetel',
    emoji: '🛰️',
    description: 'Wholesale SIP trunking and DIDs.',
    fields: [
      { key: 'sid', label: 'SID', secret: false },
      { key: 'secret', label: 'Secret', secret: true },
      { key: 'tenant_id', label: 'Tenant ID (optional)', secret: false },
      { key: 'endpoint_group_id', label: 'Outbound Endpoint Group ID', secret: false },
    ],
    guide: {
      title: 'How to get your Skyetel credentials',
      url: 'https://my.skyetel.com/',
      steps: [
        'Log in to my.skyetel.com.',
        'Go to Settings → API → Create new credential. Copy the SID and Secret.',
        'Whitelist your server IP under Settings → API → IP Authentication.',
        'Go to SIP → Endpoint Groups, open the group you want for outbound and copy its ID.',
      ],
    },
  },
  {
    id: 'voipms',
    name: 'VoIP.ms',
    emoji: '☎️',
    description: 'Affordable SIP trunking and DIDs (Canada/US).',
    fields: [
      { key: 'api_username', label: 'API Username (email)', secret: false },
      { key: 'api_password', label: 'API Password', secret: true },
      { key: 'sub_account', label: 'Sub-account (optional)', secret: false },
      { key: 'pop', label: 'Preferred POP (e.g. montreal.voip.ms)', secret: false },
    ],
    guide: {
      title: 'How to get your VoIP.ms credentials',
      url: 'https://voip.ms/m/api.php',
      steps: [
        'Log in to voip.ms.',
        'Go to Main Menu → SOAP and REST/JSON API.',
        'Enable the API, set a strong API password (different from your account password).',
        'Add your server\'s public IP to the "Enable IP Address" list (comma-separated for multiple).',
        'Save. Use your account email as API username and the API password you just set.',
      ],
    },
  },
];

export default function ProviderCredentials() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ProviderId | null>(null);
  const [testing, setTesting] = useState<ProviderId | null>(null);
  const [status, setStatus] = useState<Record<ProviderId, { ok: boolean; msg: string; at: string } | null>>({
    twilio: null, telnyx: null, skyetel: null, voipms: null,
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('lemtel_config').select('key, value');
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value ?? ''; });
      setValues(map);
      setLoading(false);
    })();
  }, []);

  const keyFor = (p: ProviderId, f: string) => `PROVIDER_${p.toUpperCase()}_${f.toUpperCase()}`;

  const saveProvider = async (p: ProviderDef) => {
    setSaving(p.id);
    const rows = p.fields.map((f) => ({
      key: keyFor(p.id, f.key),
      value: values[keyFor(p.id, f.key)] ?? '',
      is_secret: f.secret,
    }));
    const { error } = await supabase.from('lemtel_config').upsert(rows, { onConflict: 'key' });
    setSaving(null);
    if (error) toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    else toast({ title: 'Saved', description: `${p.name} credentials updated` });
  };

  const testProvider = async (p: ProviderDef) => {
    setTesting(p.id);
    const credentials: Record<string, string> = {};
    p.fields.forEach((f) => { credentials[f.key] = values[keyFor(p.id, f.key)] ?? ''; });
    try {
      const { data, error } = await supabase.functions.invoke('provider-credentials-test', {
        body: { provider: p.id, credentials },
      });
      if (error) throw error;
      const ok = !!(data as any)?.ok;
      setStatus((s) => ({ ...s, [p.id]: { ok, msg: ok ? 'Verified' : ((data as any)?.error || 'Failed'), at: new Date().toISOString() } }));
      toast({ title: ok ? 'Verified' : 'Test failed', description: ok ? `${p.name} credentials are valid` : ((data as any)?.error || ''), variant: ok ? 'default' : 'destructive' });
    } catch (e: any) {
      setStatus((s) => ({ ...s, [p.id]: { ok: false, msg: e.message, at: new Date().toISOString() } }));
      toast({ title: 'Test failed', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(null);
    }
  };

  const isConfigured = (p: ProviderDef) =>
    p.fields.filter((f) => !f.label.includes('optional')).every((f) => !!values[keyFor(p.id, f.key)]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Provider Credentials</h1>
        <p className="text-muted-foreground">
          Bring your own carrier credentials for Twilio, Telnyx, Skyetel and VoIP.ms. Each section includes a step-by-step guide.
        </p>
      </div>

      <div className="grid gap-6">
        {PROVIDERS.map((p) => {
          const st = status[p.id];
          const configured = isConfigured(p);
          return (
            <Card key={p.id} className="glass-card">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{p.emoji}</span>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {p.name}
                        {st?.ok ? (
                          <Badge className="gap-1 bg-green-600/20 text-green-400 border-green-600/40"><CheckCircle2 className="w-3 h-3" /> Verified</Badge>
                        ) : configured ? (
                          <Badge variant="secondary">Configured</Badge>
                        ) : (
                          <Badge variant="outline">Not configured</Badge>
                        )}
                        {st && !st.ok && <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Error</Badge>}
                      </CardTitle>
                      <CardDescription>{p.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  {p.fields.map((f) => {
                    const k = keyFor(p.id, f.key);
                    return (
                      <div key={f.key} className="space-y-1.5">
                        <Label htmlFor={k}>{f.label}</Label>
                        <div className="flex gap-2">
                          <Input
                            id={k}
                            type={f.secret && !show[k] ? 'password' : 'text'}
                            value={values[k] ?? ''}
                            placeholder={f.placeholder}
                            onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                            autoComplete="off"
                          />
                          {f.secret && (
                            <Button type="button" variant="outline" size="icon" onClick={() => setShow({ ...show, [k]: !show[k] })}>
                              {show[k] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={() => saveProvider(p)} disabled={saving === p.id}>
                    {saving === p.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => testProvider(p)} disabled={testing === p.id || !configured}>
                    {testing === p.id && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Test connection
                  </Button>
                  {st && (
                    <span className={`text-xs ${st.ok ? 'text-green-500' : 'text-red-500'}`}>
                      {st.ok ? '✓ ' : '✗ '}{st.msg} · {new Date(st.at).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5">
                      <ChevronDown className="w-4 h-4" /> {p.guide.title}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
                      <ol className="list-decimal pl-5 space-y-1.5">
                        {p.guide.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                      <a
                        href={p.guide.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline text-xs pt-2"
                      >
                        Open {p.name} console <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
