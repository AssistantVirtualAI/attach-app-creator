import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  { key: 'mock_mode', label: 'Use Mock Data', secret: false, section: 'Mock Data' },
];

export default function LemtelSettings() {
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      {sections.map((sec) => (
        <Card key={sec}>
          <CardHeader>
            <CardTitle>{sec}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {FIELDS.filter((f) => f.section === sec).map((f) => (
              <div key={f.key} className="space-y-2">
                <Label htmlFor={f.key}>{f.label}</Label>
                {f.key === 'mock_mode' ? (
                  <Switch
                    id={f.key}
                    checked={values[f.key] === 'true'}
                    onCheckedChange={(v) => setValues({ ...values, [f.key]: v ? 'true' : 'false' })}
                  />
                ) : (
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
                )}
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
