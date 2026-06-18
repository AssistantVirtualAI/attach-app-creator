import { Loader2, CheckCircle2, AlertTriangle, XCircle, Mic2, Brain, Download, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TranscriptStage } from '@/lib/transcriptStatus';
import { STAGE_LABEL } from '@/lib/transcriptStatus';

const STAGE_ICON: Record<TranscriptStage, React.ComponentType<{ className?: string }>> = {
  idle: Mic2,
  downloading: Download,
  transcribing: Mic2,
  analyzing: Brain,
  pending_sync: Clock,
  complete: CheckCircle2,
  unavailable: AlertTriangle,
  failed: XCircle,
};

const STAGE_TONE: Record<TranscriptStage, string> = {
  idle: 'bg-muted text-muted-foreground border-border',
  downloading: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  transcribing: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  analyzing: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
  pending_sync: 'bg-amber-400/10 text-amber-700 dark:text-amber-300 border-amber-400/30',
  complete: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  unavailable: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40',
};

export function TranscriptStagePill({ stage, detail, compact }: { stage: TranscriptStage; detail?: string; compact?: boolean }) {
  const Icon = STAGE_ICON[stage];
  const isLoading = stage === 'downloading' || stage === 'transcribing' || stage === 'analyzing';
  const label = STAGE_LABEL[stage];
  return (
    <Badge variant="outline" className={`inline-flex items-center gap-1.5 border ${STAGE_TONE[stage]}`}>
      {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
      <span className={compact ? 'text-[10px]' : 'text-xs'}>{label}</span>
      {detail && !compact && <span className="opacity-70">· {detail}</span>}
    </Badge>
  );
}
