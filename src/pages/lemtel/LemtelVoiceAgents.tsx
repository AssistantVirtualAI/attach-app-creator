import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { GlassCard, SectionHeader, NeonButton, GlassTable, KpiCard, StatusChip, EmptyStateBranded } from '@/components/ui-cockpit';
import { Badge } from '@/components/ui/badge';
import { Bot, Plus, Loader2, Sparkles, Globe, Phone, Link2, Users2 } from 'lucide-react';
import { usePbxAgents } from '@/hooks/usePbxData';
import { AssignClientDialog } from '@/components/voice-agents/AssignClientDialog';

export default function LemtelVoiceAgents() {
  const { selectedOrgId } = useOrganization();
  const { data: agents = [], isLoading } = usePbxAgents();
  const voice = (agents as any[]).filter(a => ['elevenlabs', 'vapi', 'retell'].includes((a.platform || '').toLowerCase()));
  const [assignFor, setAssignFor] = useState<{ id: string; name: string; source: 'agents' | 'pbx_softphone_users' } | null>(null);

  const { data: assignments = [] } = useQuery({
    queryKey: ['voice_agent_assignments', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await (supabase as any)
        .from('voice_agent_assignments')
        .select('id, voice_agent_id, source, client_id, phone_client_id, voice_agent_clients(name), clients(name)')
        .eq('organization_id', selectedOrgId);
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedOrgId,
  });

  const assignmentsFor = (agentId: string) => (assignments as any[]).filter(a => a.voice_agent_id === agentId);

  return (
    <div className="space-y-6">
      <SectionHeader
        icon={<Bot className="w-5 h-5" />}
        title="Voice Agents"
        subtitle="AI receptionists, intake bots, and after-hours agents wired into your phone system."
        actions={
          <>
            <NeonButton variant="outline" asChild>
              <a href="/org/lemtel/admin/agent-builder"><Sparkles className="w-4 h-4" /> Agent Builder</a>
            </NeonButton>
            <NeonButton><Plus className="w-4 h-4" /> New Voice Agent</NeonButton>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard label="Total Agents" value={voice.length} icon={<Bot className="w-4 h-4" />} accent="cyan" />
        <KpiCard label="Platforms" value={new Set(voice.map(a => a.platform)).size} icon={<Globe className="w-4 h-4" />} accent="violet" />
        <KpiCard label="External Numbers" value={voice.filter(a => a.is_external).length} icon={<Phone className="w-4 h-4" />} accent="magenta" />
      </div>

      <GlassCard>
        <div className="p-4">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-cockpit-cyan" /></div>
          ) : voice.length === 0 ? (
            <EmptyStateBranded
              icon={<Bot className="w-8 h-8" />}
              title="No voice agents yet"
              description="Build an AI receptionist, intake bot, or after-hours agent in minutes."
              action={
                <NeonButton asChild>
                  <a href="/org/lemtel/admin/agent-builder"><Sparkles className="w-4 h-4" /> Open Agent Builder</a>
                </NeonButton>
              }
            />
          ) : (
            <GlassTable
              columns={[
                { key: 'name', header: 'Agent' },
                { key: 'platform', header: 'Platform' },
                { key: 'phone', header: 'Phone' },
                { key: 'clients', header: 'Assigned Clients' },
                { key: 'status', header: 'Status' },
                { key: 'actions', header: '', align: 'right' },
              ]}
              rows={voice.map((a: any) => {
                const assigned = assignmentsFor(a.id);
                return {
                  id: a.id,
                  cells: {
                    name: (
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-cockpit-cyan/15 p-1.5"><Bot className="w-4 h-4 text-cockpit-cyan" /></div>
                        <div>
                          <div className="font-medium">{a.name}</div>
                          {a.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{a.description}</div>}
                        </div>
                      </div>
                    ),
                    platform: <Badge variant="outline" className="capitalize">{a.platform}</Badge>,
                    phone: <span className="font-mono text-xs">{a.twilio_number || '—'}</span>,
                    clients: assigned.length === 0
                      ? <span className="text-xs text-muted-foreground">Unassigned</span>
                      : (
                        <div className="flex flex-wrap gap-1">
                          {assigned.slice(0, 3).map((x: any) => (
                            <Badge key={x.id} variant="secondary" className="text-xs">
                              {x.voice_agent_clients?.name || x.clients?.name || 'Client'}
                            </Badge>
                          ))}
                          {assigned.length > 3 && <Badge variant="outline" className="text-xs">+{assigned.length - 3}</Badge>}
                        </div>
                      ),
                    status: <StatusChip status={a.is_external ? 'success' : 'idle'}>{a.is_external ? 'live' : 'draft'}</StatusChip>,
                    actions: (
                      <NeonButton size="sm" variant="outline" onClick={() => setAssignFor({ id: a.id, name: a.name, source: 'agents' })}>
                        <Link2 className="w-3.5 h-3.5" /> Assign
                      </NeonButton>
                    ),
                  },
                };
              })}
            />
          )}
        </div>
      </GlassCard>

      {assignFor && (
        <AssignClientDialog
          open={!!assignFor}
          onOpenChange={(o) => !o && setAssignFor(null)}
          voiceAgent={assignFor}
        />
      )}
    </div>
  );
}
