import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Plus, Loader2, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { LEMTEL_ORG, usePbxExtensions, usePbxRingGroups } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';

const STRATEGIES = ['simultaneous', 'sequence', 'enterprise', 'rollover', 'random'];

const copy = {
  en: {
    title: 'Ring Groups', subtitle: 'Create, edit, and sync hunt groups with FusionPBX in real time.', new: 'New Ring Group', count: 'ring groups',
    empty: 'No ring groups yet — create one to route inbound calls to several extensions.', name: 'Name', extension: 'Extension', strategy: 'Strategy', members: 'Members', status: 'Status', actions: 'Actions', enabled: 'enabled', disabled: 'disabled', destinations: 'Destinations', save: 'Save', create: 'Create', cancel: 'Cancel', description: 'Description', forwarding: 'Forwarding / fallback', synced: 'Synced to FusionPBX', failed: 'FusionPBX sync failed', deleteConfirm: 'Delete ring group from FusionPBX?'
  },
  fr: {
    title: 'Groupes d’appel', subtitle: 'Créer, modifier et synchroniser les groupes d’appel avec FusionPBX en temps réel.', new: 'Nouveau groupe', count: 'groupes',
    empty: 'Aucun groupe d’appel — créez-en un pour router les appels entrants vers plusieurs extensions.', name: 'Nom', extension: 'Extension', strategy: 'Stratégie', members: 'Membres', status: 'Statut', actions: 'Actions', enabled: 'actif', disabled: 'inactif', destinations: 'Destinations', save: 'Enregistrer', create: 'Créer', cancel: 'Annuler', description: 'Description', forwarding: 'Renvoi / secours', synced: 'Synchronisé avec FusionPBX', failed: 'Échec de synchronisation FusionPBX', deleteConfirm: 'Supprimer ce groupe dans FusionPBX ?'
  },
};

export default function TelephonyRingGroups() {
  const { data: groups = [], isLoading } = usePbxRingGroups();
  const { data: extensions = [] } = usePbxExtensions();
  const { language } = useLanguage();
  const txt = copy[language];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Bell className="w-7 h-7" /> {txt.title}</h1>
          <p className="text-muted-foreground">{txt.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="config" />
          <RingGroupDialog mode="create" extensions={extensions as any[]} txt={txt} trigger={<Button><Plus className="w-4 h-4 mr-2" /> {txt.new}</Button>} />
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>{groups.length} {txt.count}</CardTitle><CardDescription>{txt.synced}</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{txt.name}</TableHead><TableHead>{txt.extension}</TableHead><TableHead>{txt.strategy}</TableHead>
                <TableHead>{txt.members}</TableHead><TableHead>{txt.status}</TableHead><TableHead className="text-right">{txt.actions}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">{txt.empty}</TableCell></TableRow>
                ) : (groups as any[]).map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="font-mono">{g.extension || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{g.strategy || g.ring_group_strategy || '—'}</Badge></TableCell>
                    <TableCell>{getDestinations(g).length || '—'}</TableCell>
                    <TableCell><Badge variant={g.enabled === false ? 'outline' : 'default'}>{g.enabled === false ? txt.disabled : txt.enabled}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <RingGroupDialog mode="edit" group={g} extensions={extensions as any[]} txt={txt} trigger={<Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>} />
                        <DeleteRingGroup group={g} txt={txt} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
