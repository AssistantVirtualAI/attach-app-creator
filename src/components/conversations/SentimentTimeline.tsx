import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SentimentPoint {
  time_percent: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  reason: string;
}

interface SentimentTimelineProps {
  timeline: SentimentPoint[];
}

export function SentimentTimeline({ timeline }: SentimentTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Aucune donnée de sentiment disponible
      </div>
    );
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500';
      case 'negative':
        return 'bg-red-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const getSentimentY = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 20;
      case 'negative':
        return 80;
      default:
        return 50;
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-3 h-3" />;
      case 'negative':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return '😊';
      case 'negative':
        return '😞';
      default:
        return '😐';
    }
  };

  return (
    <div className="space-y-4">
      {/* Graphique de la timeline */}
      <div className="relative h-24 bg-muted/30 rounded-lg p-2">
        {/* Labels Y */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-muted-foreground pr-2">
          <span>😊</span>
          <span>😐</span>
          <span>😞</span>
        </div>

        {/* Zone du graphique */}
        <div className="ml-6 relative h-full">
          {/* Lignes de grille */}
          <div className="absolute inset-0 flex flex-col justify-between">
            <div className="border-b border-dashed border-muted-foreground/20" />
            <div className="border-b border-dashed border-muted-foreground/20" />
            <div className="border-b border-dashed border-muted-foreground/20" />
          </div>

          {/* Points et ligne de connexion */}
          <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
            {/* Ligne de connexion */}
            <motion.path
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1, ease: "easeInOut" }}
              d={timeline.map((point, i) => {
                const x = `${point.time_percent}%`;
                const y = getSentimentY(point.sentiment);
                return i === 0 ? `M ${point.time_percent}% ${y}%` : `L ${point.time_percent}% ${y}%`;
              }).join(' ')}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>

          {/* Points */}
          {timeline.map((point, index) => (
            <motion.div
              key={index}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.2, duration: 0.3 }}
              className={cn(
                "absolute w-3 h-3 rounded-full -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-150",
                getSentimentColor(point.sentiment)
              )}
              style={{
                left: `${point.time_percent}%`,
                top: `${getSentimentY(point.sentiment)}%`,
              }}
              title={point.reason}
            />
          ))}
        </div>

        {/* Labels X */}
        <div className="absolute bottom-0 left-6 right-0 flex justify-between text-xs text-muted-foreground translate-y-4">
          <span>Début</span>
          <span>Milieu</span>
          <span>Fin</span>
        </div>
      </div>

      {/* Légende détaillée */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
        {timeline.map((point, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
          >
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs",
              getSentimentColor(point.sentiment)
            )}>
              {getSentimentIcon(point.sentiment)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">
                {point.time_percent}% - {getSentimentEmoji(point.sentiment)}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {point.reason}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
