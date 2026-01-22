import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Play, Pause, Check, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VoiceSettings } from '@/hooks/useCreatePlatformAgent';

interface Voice {
  voice_id: string;
  name: string;
  labels?: Record<string, string>;
  preview_url?: string;
  description?: string;
  category?: string;
}

interface PlatformVoiceSelectorProps {
  platform: 'elevenlabs' | 'vapi' | 'retell';
  organizationId: string;
  selectedVoiceSettings: VoiceSettings;
  onSelect: (settings: VoiceSettings) => void;
}

export function PlatformVoiceSelector({
  platform,
  organizationId,
  selectedVoiceSettings,
  onSelect,
}: PlatformVoiceSelectorProps) {
  const [search, setSearch] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: voices, isLoading } = useQuery({
    queryKey: ['platform-voices', platform, organizationId],
    queryFn: async () => {
      let functionName: string;
      let actionName: string;

      switch (platform) {
        case 'elevenlabs':
          functionName = 'elevenlabs-convai-agent-config';
          actionName = 'get_voices';
          break;
        case 'vapi':
          // Vapi uses ElevenLabs voices
          functionName = 'elevenlabs-convai-agent-config';
          actionName = 'get_voices';
          break;
        case 'retell':
          functionName = 'retell-proxy';
          actionName = 'listVoices';
          break;
        default:
          throw new Error(`Unknown platform: ${platform}`);
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { action: actionName, organizationId },
      });

      if (error) throw error;
      return (data?.voices || []) as Voice[];
    },
    enabled: !!organizationId,
  });

  const handlePlayPreview = (voice: Voice) => {
    if (!voice.preview_url) return;

    if (playingId === voice.voice_id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    audioRef.current = new Audio(voice.preview_url);
    audioRef.current.play();
    audioRef.current.onended = () => setPlayingId(null);
    setPlayingId(voice.voice_id);
  };

  const filteredVoices = voices?.filter(
    (v) =>
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      Object.values(v.labels || {}).some((label) =>
        label.toLowerCase().includes(search.toLowerCase())
      )
  );

  const handleVoiceSelect = (voice: Voice) => {
    onSelect({
      ...selectedVoiceSettings,
      voice_id: voice.voice_id,
    });
  };

  const handleSettingChange = (key: keyof VoiceSettings, value: number) => {
    onSelect({
      ...selectedVoiceSettings,
      [key]: value,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search voices..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Voices Grid */}
      <ScrollArea className="h-[300px] pr-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredVoices?.map((voice) => (
            <Card
              key={voice.voice_id}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50',
                selectedVoiceSettings.voice_id === voice.voice_id &&
                  'border-primary bg-primary/5'
              )}
              onClick={() => handleVoiceSelect(voice)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{voice.name}</span>
                      {selectedVoiceSettings.voice_id === voice.voice_id && (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    {voice.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {voice.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {Object.entries(voice.labels || {}).slice(0, 3).map(([key, value]) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {voice.preview_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayPreview(voice);
                      }}
                    >
                      {playingId === voice.voice_id ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {filteredVoices?.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No voices found
          </div>
        )}
      </ScrollArea>

      {/* Voice Settings */}
      {selectedVoiceSettings.voice_id && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Voice Settings</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Stability</Label>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((selectedVoiceSettings.stability ?? 0.5) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[(selectedVoiceSettings.stability ?? 0.5) * 100]}
                  onValueChange={([v]) => handleSettingChange('stability', v / 100)}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Higher = more consistent, Lower = more expressive
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Similarity</Label>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((selectedVoiceSettings.similarity_boost ?? 0.75) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[(selectedVoiceSettings.similarity_boost ?? 0.75) * 100]}
                  onValueChange={([v]) => handleSettingChange('similarity_boost', v / 100)}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  How closely to match the original voice
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Style</Label>
                  <span className="text-xs text-muted-foreground">
                    {Math.round((selectedVoiceSettings.style ?? 0) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[(selectedVoiceSettings.style ?? 0) * 100]}
                  onValueChange={([v]) => handleSettingChange('style', v / 100)}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Amount of speaking style to apply
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm">Speed</Label>
                  <span className="text-xs text-muted-foreground">
                    {(selectedVoiceSettings.speed ?? 1).toFixed(1)}x
                  </span>
                </div>
                <Slider
                  value={[(selectedVoiceSettings.speed ?? 1) * 50]}
                  onValueChange={([v]) => handleSettingChange('speed', v / 50)}
                  min={25}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Speaking speed multiplier
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
