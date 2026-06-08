import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

export function RecordingWavePlayer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const ws = WaveSurfer.create({
      container: ref.current,
      waveColor: 'hsl(var(--muted-foreground))',
      progressColor: 'hsl(var(--primary))',
      height: 48,
      barWidth: 2,
      url,
    });
    wsRef.current = ws;
    ws.on('play', () => setPlaying(true));
    ws.on('pause', () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));
    return () => { ws.destroy(); };
  }, [url]);

  return (
    <div className="flex items-center gap-2">
      <Button size="icon" variant="outline" onClick={() => wsRef.current?.playPause()}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div ref={ref} className="flex-1 min-w-0" />
    </div>
  );
}
