import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Loader2, FlaskConical, Activity, Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePbxIntegration, usePbxMockModeToggle } from '@/hooks/usePbxData';

const FIELDS: { key: string; label: string; secret: boolean; section: string }[] = [
  { key: 'FUSIONPBX_URL', label: 'FusionPBX URL', secret: false, section: 'FusionPBX' },
  { key: 'FUSIONPBX_USERNAME', label: 'Username', secret: false, section: 'FusionPBX' },
  { key: 'FUSIONPBX_API_KEY', label: 'API Key', secret: true, section: 'FusionPBX' },
  { key: 'FUSIONPBX_WSS_URL', label: 'WSS URL', secret: false, section: 'FusionPBX' },
  { key: 'FUSIONPBX_DOMAIN', label: 'SIP Domain', secret: false, section: 'FusionPBX' },
  { key: 'TELNYX_API_KEY', label: 'Telnyx API Key', secret: true, section: 'Telnyx SMS' },
  { key: 'TELNYX_MESSAGING_PROFILE_ID', label: 'Messaging Profile ID', secret: false, section: 'Telnyx SMS' },
  { key: 'ELEVENLABS_VOICE_ID_DEFAULT', label: 'Default Voice ID', secret: false, section: 'ElevenLabs' },
  { key: 'ANTHROPIC_API_KEY', label: 'Claude API Key', secret: true, section: 'AI (Claude)' },
];

export default function LemtelSettings() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: integration, isLoading: integLoading } = usePbxIntegration();
  const toggleMock = usePbxMockModeToggle();
  const mockEnabled = !!integration?.config?.mock_mode;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('lemtel_config').select('key, value');
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => (map[r.key] = r.value ?? ''));
      setValues(map);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const rows = FIELDS.map((f) => ({ key: f.key, value: values[f.key] ?? '', is_secret: f.secret }));
    const { error } = await supabase.from('lemtel_config').upsert(rows, { onConflict: 'key' });
    setSaving(false);
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else toast({ title: 'Saved', description: 'Configuration updated' });
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  const sections = Array.from(new Set(FIELDS.map((f) => f.section)));

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Lemtel Settings</h1>
        <p className="text-muted-foreground">Configure telecom integrations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plug className="w-5 h-5" /> Carrier Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Connect your own Twilio, Telnyx, Skyetel or VoIP.ms credentials. Step-by-step guides included.
          </p>
          <Button asChild>
            <Link to="/lemtel/integrations/providers">Open Provider Credentials</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FlaskConical className="w-5 h-5" /> Data Source</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="mock_mode" className="text-base">Use Mock Data (UI Testing Mode)</Label>
              <p className="text-sm text-muted-foreground">When enabled, edge functions return seeded mock responses instead of calling FusionPBX.</p>
            </div>
            <div className="flex items-center gap-3">
              {integLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Badge variant={mockEnabled ? 'secondary' : 'default'} className="gap-1">
                  <Activity className="w-3 h-3" />
                  {mockEnabled ? 'Mock' : 'Live'}
                </Badge>
              )}
              <Switch
                id="mock_mode"
                checked={mockEnabled}
                disabled={toggleMock.isPending || integLoading}
                onCheckedChange={(v) => toggleMock.mutate(v)}
              />
            </div>
          </div>
          {integration?.status && (
            <p className="text-xs text-muted-foreground">Integration status: <span className="font-mono">{integration.status}</span>{integration.last_sync_at ? ` · last sync ${new Date(integration.last_sync_at).toLocaleString()}` : ''}</p>
          )}
        </CardContent>
      </Card>

      {sections.map((sec) => (
        <Card key={sec}>
          <CardHeader>
            <CardTitle>{sec}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.filter((f) => f.section === sec).map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                <div className="flex gap-2">
                  <Input
                    id={f.key}
                    type={f.secret && !show[f.key] ? 'password' : 'text'}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                  {f.secret && (
                    <Button variant="outline" size="icon" type="button" onClick={() => setShow({ ...show, [f.key]: !show[f.key] })}>
                      {show[f.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Button onClick={save} disabled={saving} size="lg">
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Save All
      </Button>
    </div>
  );
}
