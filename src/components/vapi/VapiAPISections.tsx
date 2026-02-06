import { useState } from 'react';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bot, Users, Phone, Megaphone, Layers, Wrench, Puzzle,
  FileText, BarChart3, ScrollText, BookOpen, Loader2, Trash2,
  RefreshCw, Save, Settings2, MessageSquare, Volume2, Brain,
  Clock, Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useVapiAssistant,
  useVapiAssistants,
  useUpdateVapiAssistant,
  useVapiSquads,
  useDeleteVapiSquad,
  useVapiCalls,
  useVapiCampaigns,
  useDeleteVapiCampaign,
  useVapiSessions,
  useVapiPhoneNumbers,
  useDeleteVapiPhoneNumber,
  useVapiTools,
  useDeleteVapiTool,
  useVapiBlocks,
  useDeleteVapiBlock,
  useVapiFiles,
  useDeleteVapiFile,
  useVapiAnalytics,
  useVapiLogs,
  useVapiKnowledgeBases,
  useDeleteVapiKnowledgeBase,
} from '@/hooks/useVapiFullConfig';

interface VapiAPISectionsProps {
  organizationId?: string;
  apiKey?: string | null;
  assistantId?: string | null;
  canEdit?: boolean;
}

export function VapiAPISections({ organizationId, apiKey, assistantId, canEdit = true }: VapiAPISectionsProps) {
  const hookParams = { organizationId, apiKey };
  const [timeframe, setTimeframe] = useState('7d');
  const [logLevel, setLogLevel] = useState<string | undefined>();

  // Assistant config
  const { data: assistantConfig, isLoading: loadingAssistant, refetch: refetchAssistant } = useVapiAssistant({ ...hookParams, assistantId });
  const updateAssistant = useUpdateVapiAssistant();

  // Local state for assistant editing
  const [systemPrompt, setSystemPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [endCallMessage, setEndCallMessage] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1000);
  const [silenceTimeout, setSilenceTimeout] = useState(10);
  const [maxDuration, setMaxDuration] = useState(600);
  const [serverUrl, setServerUrl] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);

  // Sync assistant config to local state
  if (assistantConfig && !configLoaded) {
    const model = assistantConfig.model;
    const sysMsg = model?.messages?.find((m: any) => m.role === 'system');
    if (sysMsg) setSystemPrompt(sysMsg.content || '');
    setFirstMessage(assistantConfig.firstMessage || '');
    setEndCallMessage(assistantConfig.endCallMessage || '');
    setTemperature(model?.temperature ?? 0.7);
    setMaxTokens(model?.maxTokens || 1000);
    setSilenceTimeout(assistantConfig.silenceTimeoutSeconds || 10);
    setMaxDuration(assistantConfig.maxDurationSeconds || 600);
    setServerUrl(assistantConfig.serverUrl || '');
    setConfigLoaded(true);
  }

  const handleSaveAssistant = () => {
    if (!assistantId) return;
    const config: any = {};
    if (systemPrompt || temperature !== undefined) {
      config.model = {
        ...(assistantConfig?.model || {}),
        temperature,
        maxTokens,
        messages: [{ role: 'system', content: systemPrompt }],
      };
    }
    config.firstMessage = firstMessage;
    config.endCallMessage = endCallMessage;
    config.silenceTimeoutSeconds = silenceTimeout;
    config.maxDurationSeconds = maxDuration;
    if (serverUrl) config.serverUrl = serverUrl;
    updateAssistant.mutate({
      organizationId, apiKey: apiKey || undefined,
      assistantId, config,
    });
  };

  // Lists
  const { data: squads, isLoading: loadingSquads } = useVapiSquads(hookParams);
  const { data: calls, isLoading: loadingCalls } = useVapiCalls({ ...hookParams, assistantId });
  const { data: campaigns, isLoading: loadingCampaigns } = useVapiCampaigns(hookParams);
  const { data: sessions, isLoading: loadingSessions } = useVapiSessions(hookParams);
  const { data: phoneNumbers, isLoading: loadingPhones } = useVapiPhoneNumbers(hookParams);
  const { data: tools, isLoading: loadingTools } = useVapiTools(hookParams);
  const { data: blocks, isLoading: loadingBlocks } = useVapiBlocks(hookParams);
  const { data: files, isLoading: loadingFiles } = useVapiFiles(hookParams);
  const { data: analytics, isLoading: loadingAnalytics } = useVapiAnalytics(hookParams, timeframe);
  const { data: logs, isLoading: loadingLogs } = useVapiLogs(hookParams, { level: logLevel });
  const { data: knowledgeBases, isLoading: loadingKB } = useVapiKnowledgeBases(hookParams);

  // Deletions
  const deleteSquad = useDeleteVapiSquad();
  const deleteCampaign = useDeleteVapiCampaign();
  const deletePhone = useDeleteVapiPhoneNumber();
  const deleteTool = useDeleteVapiTool();
  const deleteBlock = useDeleteVapiBlock();
  const deleteFile = useDeleteVapiFile();
  const deleteKB = useDeleteVapiKnowledgeBase();

  const renderList = (items: any[] | undefined, loading: boolean, renderItem: (item: any) => React.ReactNode, emptyMsg: string) => {
    if (loading) return <Skeleton className="h-20 w-full" />;
    const arr = Array.isArray(items) ? items : [];
    if (arr.length === 0) return <p className="text-sm text-muted-foreground py-4">{emptyMsg}</p>;
    return <div className="space-y-2 max-h-80 overflow-y-auto">{arr.map(renderItem)}</div>;
  };

  return (
    <Accordion type="multiple" className="space-y-3">
      {/* 1. Assistant Config */}
      {assistantId && (
        <AccordionItem value="assistant-config" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><MessageSquare className="h-5 w-5 text-blue-500" /></div>
              <div className="text-left">
                <h3 className="font-semibold">Configuration Assistant</h3>
                <p className="text-sm text-muted-foreground">Prompt, voix, modèle LLM</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            {loadingAssistant ? <Skeleton className="h-40 w-full" /> : (
              <div className="space-y-6">
                <div>
                  <Label>Prompt Système</Label>
                  <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} rows={8} className="mt-2 font-mono text-sm" disabled={!canEdit} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Premier Message</Label>
                    <Textarea value={firstMessage} onChange={e => setFirstMessage(e.target.value)} rows={3} className="mt-2" disabled={!canEdit} />
                  </div>
                  <div>
                    <Label>Message de fin d'appel</Label>
                    <Textarea value={endCallMessage} onChange={e => setEndCallMessage(e.target.value)} rows={3} className="mt-2" disabled={!canEdit} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Modèle LLM</Label>
                    <Input value={assistantConfig?.model?.model || 'gpt-4o-mini'} disabled className="mt-2" />
                  </div>
                  <div>
                    <Label>Provider</Label>
                    <Input value={assistantConfig?.model?.provider || 'openai'} disabled className="mt-2" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Température ({temperature.toFixed(1)})</Label>
                    <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} min={0} max={2} step={0.1} className="mt-4" disabled={!canEdit} />
                  </div>
                  <div>
                    <Label>Max Tokens ({maxTokens})</Label>
                    <Slider value={[maxTokens]} onValueChange={([v]) => setMaxTokens(v)} min={100} max={8000} step={100} className="mt-4" disabled={!canEdit} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Timeout silence ({silenceTimeout}s)</Label>
                    <Slider value={[silenceTimeout]} onValueChange={([v]) => setSilenceTimeout(v)} min={5} max={60} step={1} className="mt-4" disabled={!canEdit} />
                  </div>
                  <div>
                    <Label>Durée max ({Math.round(maxDuration / 60)} min)</Label>
                    <Slider value={[maxDuration]} onValueChange={([v]) => setMaxDuration(v)} min={60} max={7200} step={60} className="mt-4" disabled={!canEdit} />
                  </div>
                </div>
                <div>
                  <Label>Server URL (Webhook)</Label>
                  <Input value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://..." className="mt-2" disabled={!canEdit} />
                </div>
                {/* Voice info */}
                {assistantConfig?.voice && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm text-muted-foreground">Voix actuelle</p>
                    <p className="font-medium">{assistantConfig.voice.provider} — {assistantConfig.voice.voiceId}</p>
                  </div>
                )}
                {canEdit && (
                  <Button onClick={handleSaveAssistant} disabled={updateAssistant.isPending}>
                    {updateAssistant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-2" /> Sauvegarder
                  </Button>
                )}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      )}

      {/* 2. Squads */}
      <AccordionItem value="squads" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10"><Users className="h-5 w-5 text-purple-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Squads</h3>
              <p className="text-sm text-muted-foreground">Équipes d'assistants</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(squads, loadingSquads, (s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{s.name || s.id}</p>
                <p className="text-xs text-muted-foreground">{s.members?.length || 0} membres</p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => deleteSquad.mutate({ organizationId, apiKey: apiKey || undefined, squadId: s.id })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ), 'Aucun squad configuré')}
        </AccordionContent>
      </AccordionItem>

      {/* 3. Phone Numbers */}
      <AccordionItem value="phones" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10"><Phone className="h-5 w-5 text-green-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Numéros de Téléphone</h3>
              <p className="text-sm text-muted-foreground">Gestion des numéros</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(phoneNumbers, loadingPhones, (p: any) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm font-mono">{p.number || p.phoneNumber || p.id}</p>
                <p className="text-xs text-muted-foreground">{p.provider || 'vapi'} {p.name ? `— ${p.name}` : ''}</p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => deletePhone.mutate({ organizationId, apiKey: apiKey || undefined, phoneNumberId: p.id })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ), 'Aucun numéro configuré')}
        </AccordionContent>
      </AccordionItem>

      {/* 4. Campaigns */}
      <AccordionItem value="campaigns" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10"><Megaphone className="h-5 w-5 text-orange-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Campagnes</h3>
              <p className="text-sm text-muted-foreground">Campagnes d'appels en masse</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(campaigns, loadingCampaigns, (c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{c.name || c.id}</p>
                <p className="text-xs text-muted-foreground">{c.status || 'draft'} — {c.customers?.length || 0} contacts</p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => deleteCampaign.mutate({ organizationId, apiKey: apiKey || undefined, campaignId: c.id })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ), 'Aucune campagne')}
        </AccordionContent>
      </AccordionItem>

      {/* 5. Tools */}
      <AccordionItem value="tools" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10"><Wrench className="h-5 w-5 text-cyan-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Outils</h3>
              <p className="text-sm text-muted-foreground">Fonctions et intégrations</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(tools, loadingTools, (t: any) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{t.function?.name || t.type || t.id}</p>
                <Badge variant="outline" className="mt-1">{t.type}</Badge>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => deleteTool.mutate({ organizationId, apiKey: apiKey || undefined, toolId: t.id })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ), 'Aucun outil configuré')}
        </AccordionContent>
      </AccordionItem>

      {/* 6. Blocks */}
      <AccordionItem value="blocks" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/10"><Puzzle className="h-5 w-5 text-pink-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Blocs</h3>
              <p className="text-sm text-muted-foreground">Blocs de conversation</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(blocks, loadingBlocks, (b: any) => (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{b.name || b.type || b.id}</p>
                <Badge variant="outline" className="mt-1">{b.type}</Badge>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => deleteBlock.mutate({ organizationId, apiKey: apiKey || undefined, blockId: b.id })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ), 'Aucun bloc')}
        </AccordionContent>
      </AccordionItem>

      {/* 7. Files */}
      <AccordionItem value="files" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10"><FileText className="h-5 w-5 text-amber-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Fichiers</h3>
              <p className="text-sm text-muted-foreground">Fichiers uploadés</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(files, loadingFiles, (f: any) => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{f.name || f.id}</p>
                <p className="text-xs text-muted-foreground">{f.purpose || 'assistants'}</p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => deleteFile.mutate({ organizationId, apiKey: apiKey || undefined, fileId: f.id })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ), 'Aucun fichier')}
        </AccordionContent>
      </AccordionItem>

      {/* 8. Knowledge Bases */}
      <AccordionItem value="kb" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10"><BookOpen className="h-5 w-5 text-indigo-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Bases de connaissances</h3>
              <p className="text-sm text-muted-foreground">Knowledge bases Vapi</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(knowledgeBases, loadingKB, (kb: any) => (
            <div key={kb.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium text-sm">{kb.name || kb.id}</p>
                <p className="text-xs text-muted-foreground">{kb.fileIds?.length || 0} fichiers</p>
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon" onClick={() => deleteKB.mutate({ organizationId, apiKey: apiKey || undefined, knowledgeBaseId: kb.id })}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ), 'Aucune base de connaissances')}
        </AccordionContent>
      </AccordionItem>

      {/* 9. Analytics */}
      <AccordionItem value="analytics" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10"><BarChart3 className="h-5 w-5 text-emerald-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Analytiques</h3>
              <p className="text-sm text-muted-foreground">Métriques et statistiques</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              {['24h', '7d', '30d', '90d'].map(t => (
                <Button key={t} variant={timeframe === t ? 'default' : 'outline'} size="sm" onClick={() => setTimeframe(t)}>
                  {t}
                </Button>
              ))}
            </div>
            {loadingAnalytics ? <Skeleton className="h-32 w-full" /> : analytics ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold">{analytics.totalCalls || 0}</p>
                  <p className="text-xs text-muted-foreground">Total appels</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold">{analytics.completedCalls || 0}</p>
                  <p className="text-xs text-muted-foreground">Complétés</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold">{analytics.successRate || 0}%</p>
                  <p className="text-xs text-muted-foreground">Taux réussite</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl font-bold">{analytics.avgDuration || 0}s</p>
                  <p className="text-xs text-muted-foreground">Durée moy.</p>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">Aucune donnée</p>}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 10. Logs */}
      <AccordionItem value="logs" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-500/10"><ScrollText className="h-5 w-5 text-gray-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Logs</h3>
              <p className="text-sm text-muted-foreground">Journaux d'événements</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          <div className="space-y-4">
            <div className="flex gap-2">
              {[undefined, 'info', 'warn', 'error'].map(lvl => (
                <Button key={lvl || 'all'} variant={logLevel === lvl ? 'default' : 'outline'} size="sm" onClick={() => setLogLevel(lvl)}>
                  {lvl || 'Tous'}
                </Button>
              ))}
            </div>
            {loadingLogs ? <Skeleton className="h-32 w-full" /> : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {Array.isArray(logs) && logs.length > 0 ? logs.slice(0, 50).map((log: any, i: number) => (
                  <div key={i} className="p-2 rounded border font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'secondary' : 'outline'} className="text-xs">
                        {log.level || 'info'}
                      </Badge>
                      <span className="text-muted-foreground">{log.timestamp || log.createdAt}</span>
                    </div>
                    <p className="mt-1 break-all">{log.message || JSON.stringify(log).slice(0, 200)}</p>
                  </div>
                )) : <p className="text-sm text-muted-foreground">Aucun log disponible</p>}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* 11. Recent Calls */}
      <AccordionItem value="calls" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10"><Phone className="h-5 w-5 text-red-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Appels récents</h3>
              <p className="text-sm text-muted-foreground">Historique des appels</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(calls, loadingCalls, (c: any) => (
            <div key={c.id} className="p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm font-mono">{c.id?.slice(0, 8)}...</p>
                <Badge variant={c.status === 'ended' ? 'default' : c.status === 'in-progress' ? 'secondary' : 'outline'}>
                  {c.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {c.customer?.number || 'Web call'} — {new Date(c.createdAt).toLocaleString()}
              </p>
            </div>
          ), 'Aucun appel récent')}
        </AccordionContent>
      </AccordionItem>

      {/* 12. Sessions */}
      <AccordionItem value="sessions" className="border rounded-lg bg-card">
        <AccordionTrigger className="px-6 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10"><Layers className="h-5 w-5 text-teal-500" /></div>
            <div className="text-left">
              <h3 className="font-semibold">Sessions</h3>
              <p className="text-sm text-muted-foreground">Sessions actives et passées</p>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          {renderList(sessions, loadingSessions, (s: any) => (
            <div key={s.id} className="p-3 rounded-lg border">
              <p className="font-medium text-sm">{s.name || s.id}</p>
              <p className="text-xs text-muted-foreground">{s.status || 'active'}</p>
            </div>
          ), 'Aucune session')}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
