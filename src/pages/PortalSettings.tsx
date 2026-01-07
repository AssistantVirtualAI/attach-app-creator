import { useState, useEffect } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Settings, Volume2, Sparkles, Mic, Zap, Clock, MessageSquare, Save, Loader2, RefreshCw, Users, Plus, Edit, Trash2, Key, UserPlus, Shield, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { VoiceSelector } from '@/components/agents/VoiceSelector';
import { toast } from 'sonner';
import { RetellFullConfigTab } from '@/components/agents/RetellFullConfigTab';
import {
  useElevenLabsFullAgentConfig,
  useUpdateTTSSettings,
  useUpdateASRSettings,
  useUpdateTurnSettings,
  useUpdatePrompt,
} from '@/hooks/useElevenLabsFullConfig';
import { TURN_EAGERNESS_OPTIONS, TTS_MODELS } from '@/types/elevenlabs-full';
import type { TTSSettings, ASRSettings, TurnSettings } from '@/types/elevenlabs-full';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  login_id: string | null;
  status: string;
  created_at: string;
  last_login_at: string | null;
}

const PortalSettings = () => {
  const { session, hasEditAccess } = usePortal();
  const canEdit = hasEditAccess();

  // Retell: use dedicated settings (voices + LLM prompt) backed by retell-proxy
  if (session?.platform === 'retell' && session.organizationId) {
    if (!canEdit) {
      return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24">
          <div className="w-24 h-24 rounded-2xl bg-muted/20 flex items-center justify-center mb-6">
            <Settings className="h-12 w-12 text-muted-foreground/30" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
          <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder à cette page</p>
        </motion.div>
      );
    }

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <PortalPageHeader icon={Settings} title="Configuration" description={session?.agentName} gradient="pink-orange" />
        <RetellFullConfigTab
          agentId={session.agentId}
          platformAgentId={session.platformAgentId || null}
          organizationId={session.organizationId}
          apiKey={session.platformApiKey}
        />
      </motion.div>
    );
  }

  const agentId = session?.platformAgentId || session?.agentId;
  const apiKey = session?.platformApiKey || null;

  const { data: config, isLoading, refetch } = useElevenLabsFullAgentConfig({
    agentId: agentId || null,
    apiKey: apiKey,
    enabled: !!agentId && !!apiKey && canEdit,
  });

  const updateTTS = useUpdateTTSSettings();
  const updateASR = useUpdateASRSettings();
  const updateTurn = useUpdateTurnSettings();
  const updatePrompt = useUpdatePrompt();

  // Members state
  const [members, setMembers] = useState<Member[]>([]);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addLoginId, setAddLoginId] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [isAdding, setIsAdding] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMemberId, setResetMemberId] = useState('');
  const [resetMemberName, setResetMemberName] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Settings state
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>({
    voice_id: '',
    model_id: 'eleven_turbo_v2_5',
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    speed: 1,
  });

  const [asrSettings, setAsrSettings] = useState<ASRSettings>({
    quality: 'high',
    keywords: [],
  });

  const [turnSettings, setTurnSettings] = useState<TurnSettings>({
    turn_timeout: 10,
    silence_end_call_timeout: 30,
    turn_eagerness: 'normal',
  });

  const [prompt, setPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [keywords, setKeywords] = useState('');

  // Fetch members
  useEffect(() => {
    if (session && canEdit) {
      fetchMembers();
    }
  }, [session, canEdit]);

  const fetchMembers = async () => {
    if (!session) return;
    setIsMembersLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: { action: 'get-members', client_id: session.clientId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMembers(data?.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setIsMembersLoading(false);
    }
  };

  // Sync config to local state
  useEffect(() => {
    if (config) {
      const tts = config.conversation_config?.tts;
      const stt = config.conversation_config?.stt;
      const turn = config.conversation_config?.turn;
      const agent = config.conversation_config?.agent;

      if (tts) setTtsSettings(prev => ({ ...prev, ...tts }));
      if (stt) {
        setAsrSettings(prev => ({ ...prev, ...stt }));
        if (stt.keywords) setKeywords(stt.keywords.join(', '));
      }
      if (turn) setTurnSettings(prev => ({ ...prev, ...turn }));
      if (agent) {
        setPrompt(agent.prompt?.prompt || '');
        setFirstMessage(agent.first_message || '');
      }
    }
  }, [config]);

  // Member handlers
  const handleAddMember = async () => {
    if (!session) return;
    setIsAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: { action: 'admin-add-member', client_id: session.clientId, name: addName, email: addEmail, login_id: addLoginId, password: addPassword, role: addRole }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Membre ajouté avec succès');
      setShowAddModal(false);
      resetAddForm();
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de l\'ajout');
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditMember = async () => {
    if (!editingMember) return;
    setIsEditing(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: { action: 'admin-update-member', member_id: editingMember.id, name: editName, email: editEmail, role: editRole, status: editStatus }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Membre mis à jour');
      setShowEditModal(false);
      setEditingMember(null);
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsEditing(false);
    }
  };

  const handleResetPassword = async () => {
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: { action: 'admin-reset-member-password', member_id: resetMemberId, new_password: resetPassword }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Mot de passe réinitialisé');
      setShowResetModal(false);
      setResetPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la réinitialisation');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: { action: 'admin-delete-member', member_id: deletingMember.id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Membre supprimé');
      setShowDeleteDialog(false);
      setDeletingMember(null);
      fetchMembers();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetAddForm = () => {
    setAddName(''); setAddEmail(''); setAddLoginId(''); setAddPassword(''); setAddRole('member');
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(member.role);
    setEditStatus(member.status);
    setShowEditModal(true);
  };

  const openResetModal = (member: Member) => {
    setResetMemberId(member.id);
    setResetMemberName(member.name);
    setResetPassword('');
    setShowResetModal(true);
  };

  // Settings handlers
  const handleSaveTTS = () => {
    if (!agentId) return;
    updateTTS.mutate({ agentId, apiKey: apiKey || undefined, ttsSettings });
  };

  const handleSaveASR = () => {
    if (!agentId) return;
    const keywordsArray = keywords.split(',').map(k => k.trim()).filter(Boolean);
    updateASR.mutate({ agentId, apiKey: apiKey || undefined, asrSettings: { ...asrSettings, keywords: keywordsArray } });
  };

  const handleSaveTurn = () => {
    if (!agentId) return;
    updateTurn.mutate({ agentId, apiKey: apiKey || undefined, turnSettings });
  };

  const handleSavePrompt = () => {
    if (!agentId) return;
    updatePrompt.mutate({ agentId, apiKey: apiKey || undefined, prompt, firstMessage });
  };

  if (!canEdit) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-24">
        <div className="w-24 h-24 rounded-2xl bg-muted/20 flex items-center justify-center mb-6">
          <Settings className="h-12 w-12 text-muted-foreground/30" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
        <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder à cette page</p>
      </motion.div>
    );
  }

  const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  if (isLoading) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <PortalPageHeader icon={Settings} title="Configuration" description={session?.agentName} gradient="pink-orange" />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex items-center justify-between">
        <PortalPageHeader icon={Settings} title="Configuration" description={session?.agentName} gradient="pink-orange" />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <Tabs defaultValue="voice" className="space-y-6">
        <TabsList className="bg-muted/30 border border-border/30">
          <TabsTrigger value="voice" className="gap-2"><Volume2 className="h-4 w-4" />Voix</TabsTrigger>
          <TabsTrigger value="turn" className="gap-2"><Clock className="h-4 w-4" />Tours</TabsTrigger>
          <TabsTrigger value="asr" className="gap-2"><Mic className="h-4 w-4" />ASR</TabsTrigger>
          <TabsTrigger value="prompt" className="gap-2"><MessageSquare className="h-4 w-4" />Prompt</TabsTrigger>
          <TabsTrigger value="members" className="gap-2"><Users className="h-4 w-4" />Membres</TabsTrigger>
        </TabsList>

        {/* Voice Tab */}
        <TabsContent value="voice">
          <motion.div variants={itemVariants}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Volume2 className="h-5 w-5 text-primary" />Paramètres de Voix</CardTitle>
                <CardDescription>Synthèse vocale et caractéristiques</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-base font-medium mb-4 block">Sélectionner une voix</Label>
                  <VoiceSelector selectedVoiceId={ttsSettings.voice_id} onSelect={(voice) => setTtsSettings(prev => ({ ...prev, voice_id: voice.voice_id }))} apiKey={apiKey} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Modèle TTS</Label>
                    <Select value={ttsSettings.model_id || 'eleven_turbo_v2_5'} onValueChange={(v) => setTtsSettings(prev => ({ ...prev, model_id: v }))}>
                      <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TTS_MODELS.map(model => (<SelectItem key={model.id} value={model.id}>{model.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vitesse ({ttsSettings.speed?.toFixed(1)}x)</Label>
                    <Slider value={[ttsSettings.speed || 1]} onValueChange={([v]) => setTtsSettings(prev => ({ ...prev, speed: v }))} min={0.5} max={2} step={0.1} className="mt-4" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <Label>Stabilité ({Math.round((ttsSettings.stability || 0.5) * 100)}%)</Label>
                    <Slider value={[ttsSettings.stability || 0.5]} onValueChange={([v]) => setTtsSettings(prev => ({ ...prev, stability: v }))} min={0} max={1} step={0.01} className="mt-4" />
                  </div>
                  <div>
                    <Label>Similarité ({Math.round((ttsSettings.similarity_boost || 0.75) * 100)}%)</Label>
                    <Slider value={[ttsSettings.similarity_boost || 0.75]} onValueChange={([v]) => setTtsSettings(prev => ({ ...prev, similarity_boost: v }))} min={0} max={1} step={0.01} className="mt-4" />
                  </div>
                  <div>
                    <Label>Style ({Math.round((ttsSettings.style || 0) * 100)}%)</Label>
                    <Slider value={[ttsSettings.style || 0]} onValueChange={([v]) => setTtsSettings(prev => ({ ...prev, style: v }))} min={0} max={1} step={0.01} className="mt-4" />
                  </div>
                </div>
                <Button onClick={handleSaveTTS} disabled={updateTTS.isPending} className="gap-2 bg-gradient-to-r from-primary to-purple-500">
                  {updateTTS.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Sauvegarder Voix
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Turn Tab */}
        <TabsContent value="turn">
          <motion.div variants={itemVariants}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5 text-orange-500" />Gestion des Tours</CardTitle>
                <CardDescription>Timing et interruptions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Réactivité de l'agent</Label>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {TURN_EAGERNESS_OPTIONS.map(option => (
                      <Card key={option.value} className={`p-4 cursor-pointer transition-all ${turnSettings.turn_eagerness === option.value ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`} onClick={() => setTurnSettings(prev => ({ ...prev, turn_eagerness: option.value as any }))}>
                        <h4 className="font-medium">{option.label}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                      </Card>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Timeout de tour ({turnSettings.turn_timeout}s)</Label>
                    <Slider value={[turnSettings.turn_timeout || 10]} onValueChange={([v]) => setTurnSettings(prev => ({ ...prev, turn_timeout: v }))} min={5} max={30} step={1} className="mt-4" />
                  </div>
                  <div>
                    <Label>Fin d'appel sur silence ({turnSettings.silence_end_call_timeout}s)</Label>
                    <Slider value={[turnSettings.silence_end_call_timeout || 30]} onValueChange={([v]) => setTurnSettings(prev => ({ ...prev, silence_end_call_timeout: v }))} min={10} max={120} step={5} className="mt-4" />
                  </div>
                </div>
                <Button onClick={handleSaveTurn} disabled={updateTurn.isPending} className="gap-2">
                  {updateTurn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Sauvegarder Tours
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* ASR Tab */}
        <TabsContent value="asr">
          <motion.div variants={itemVariants}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mic className="h-5 w-5 text-purple-500" />Reconnaissance Vocale</CardTitle>
                <CardDescription>Paramètres ASR</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Qualité</Label>
                  <Select value={asrSettings.quality || 'high'} onValueChange={(v: any) => setAsrSettings(prev => ({ ...prev, quality: v }))}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">Haute (recommandé)</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mots-clés personnalisés</Label>
                  <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="mot1, mot2, mot3..." className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-2">Séparez les mots-clés par des virgules pour améliorer la reconnaissance.</p>
                </div>
                <Button onClick={handleSaveASR} disabled={updateASR.isPending} className="gap-2">
                  {updateASR.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Sauvegarder ASR
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Prompt Tab */}
        <TabsContent value="prompt">
          <motion.div variants={itemVariants}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-pink-500" />Prompt & Premier Message</CardTitle>
                <CardDescription>Instructions de l'agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Prompt Système</Label>
                  <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={6} className="mt-2 font-mono text-sm" placeholder="Vous êtes un assistant IA..." />
                </div>
                <div>
                  <Label>Premier Message</Label>
                  <Textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} rows={2} className="mt-2" placeholder="Bonjour, comment puis-je vous aider ?" />
                </div>
                <Button onClick={handleSavePrompt} disabled={updatePrompt.isPending} className="gap-2 bg-gradient-to-r from-pink-500 to-purple-500">
                  {updatePrompt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Sauvegarder Prompt
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <motion.div variants={itemVariants}>
            <Card className="bg-card/50 backdrop-blur-sm border-border/30">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" />Membres ({members.length})</CardTitle>
                  <CardDescription>Les membres peuvent accéder au portail avec leurs propres identifiants</CardDescription>
                </div>
                <Button onClick={() => setShowAddModal(true)} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Ajouter un membre
                </Button>
              </CardHeader>
              <CardContent>
                {isMembersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">Aucun membre ajouté</p>
                    <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowAddModal(true)}>
                      <Plus className="h-4 w-4" />
                      Ajouter le premier membre
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Login ID</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Dernière connexion</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>{member.email}</TableCell>
                          <TableCell><code className="text-xs bg-muted px-2 py-1 rounded">{member.login_id || '-'}</code></TableCell>
                          <TableCell>
                            <GlowBadge variant={member.role === 'admin' ? 'warning' : 'secondary'}>
                              {member.role === 'admin' ? 'Admin' : 'Membre'}
                            </GlowBadge>
                          </TableCell>
                          <TableCell>
                            {member.status === 'active' ? (
                              <span className="flex items-center gap-1 text-green-500"><CheckCircle className="h-4 w-4" />Actif</span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-500"><XCircle className="h-4 w-4" />Inactif</span>
                            )}
                          </TableCell>
                          <TableCell>{member.last_login_at ? new Date(member.last_login_at).toLocaleDateString('fr-FR') : 'Jamais'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditModal(member)}><Edit className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" onClick={() => openResetModal(member)}><Key className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setDeletingMember(member); setShowDeleteDialog(true); }}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Tips Card */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 border-border/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">Conseil IA<Zap className="h-3 w-3 text-yellow-400" /></h3>
                <p className="text-sm text-muted-foreground">
                  Pour de meilleurs résultats, ajustez la stabilité entre 0.3 et 0.7. 
                  Une valeur trop haute peut rendre la voix monotone. Utilisez les mots-clés
                  pour améliorer la reconnaissance de termes spécifiques à votre domaine.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Member Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
            <DialogDescription>Créez un nouveau compte membre pour accéder au portail</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="jean@example.com" />
            </div>
            <div className="space-y-2">
              <Label>Identifiant de connexion *</Label>
              <Input value={addLoginId} onChange={(e) => setAddLoginId(e.target.value)} placeholder="jean.dupont" />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe * (min. 8 caractères)</Label>
              <div className="relative">
                <Input type={showAddPassword ? 'text' : 'password'} value={addPassword} onChange={(e) => setAddPassword(e.target.value)} placeholder="••••••••" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowAddPassword(!showAddPassword)}>
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre (lecture seule)</SelectItem>
                  <SelectItem value="admin">Admin (gestion complète)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>Annuler</Button>
            <Button onClick={handleAddMember} disabled={isAdding || !addName || !addEmail || !addLoginId || addPassword.length < 8}>
              {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le membre</DialogTitle>
            <DialogDescription>Modifiez les informations de {editingMember?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Annuler</Button>
            <Button onClick={handleEditMember} disabled={isEditing}>
              {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>Nouveau mot de passe pour {resetMemberName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe (min. 8 caractères)</Label>
              <div className="relative">
                <Input type={showResetPassword ? 'text' : 'password'} value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="••••••••" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowResetPassword(!showResetPassword)}>
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetModal(false)}>Annuler</Button>
            <Button onClick={handleResetPassword} disabled={isResetting || resetPassword.length < 8}>
              {isResetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {deletingMember?.name} ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default PortalSettings;