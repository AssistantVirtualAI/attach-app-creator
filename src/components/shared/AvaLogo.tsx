import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: {
    container: 'h-8 gap-2',
    icon: 'h-6 w-6',
    iconContainer: 'w-8 h-8 rounded-lg p-1',
    text: 'text-lg',
    subtitle: 'text-[8px]',
  },
  md: {
    container: 'h-10 gap-2.5',
    icon: 'h-5 w-5',
    iconContainer: 'w-10 h-10 rounded-xl p-1.5',
    text: 'text-xl',
    subtitle: 'text-[10px]',
  },
  lg: {
    container: 'h-16 gap-3',
    icon: 'h-7 w-7',
    iconContainer: 'w-12 h-12 rounded-xl p-2',
    text: 'text-3xl',
    subtitle: 'text-xs',
  },
};

export function AvaLogo({ size = 'md', animated = true, showText = true, className }: AvaLogoProps) {
  const sizes = sizeClasses[size];

  const iconVariants = {
    initial: { scale: 1, rotate: 0 },
    animate: {
      scale: [1, 1.05, 1],
      rotate: [0, 5, -5, 0],
      transition: {
        duration: 4,
        repeat: Infinity,
        ease: 'easeInOut' as const,
      },
    },
  };

  const glowVariants = {
    initial: { opacity: 0.5 },
    animate: {
      opacity: [0.5, 0.8, 0.5],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut' as const,
      },
    },
  };

  return (
    <div className={cn('flex items-center', sizes.container, className)}>
      <div className="relative">
        {/* Glow effect */}
        <motion.div
          variants={glowVariants}
          initial="initial"
          animate={animated ? 'animate' : 'initial'}
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary via-secondary to-accent blur-xl"
        />
        
        {/* Icon container */}
        <motion.div
          variants={iconVariants}
          initial="initial"
          animate={animated ? 'animate' : 'initial'}
          className={cn(
            "relative bg-gradient-to-br from-primary via-secondary to-accent shadow-lg flex items-center justify-center",
            sizes.iconContainer
          )}
        >
          <div className="rounded-lg bg-background/90 w-full h-full flex items-center justify-center">
            <BarChart3 className={cn(sizes.icon, 'text-transparent bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text')} style={{ stroke: 'url(#ava-gradient)' }} />
          </div>
        </motion.div>

        {/* SVG gradient for icon */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="ava-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="50%" stopColor="hsl(var(--secondary))" />
              <stop offset="100%" stopColor="hsl(var(--accent))" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              sizes.text,
              'font-black tracking-tight bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent'
            )}
          >
            AVA
          </motion.span>
          <motion.span
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className={cn(sizes.subtitle, 'font-medium text-muted-foreground tracking-widest uppercase -mt-1')}
          >
            Statistics
          </motion.span>
        </div>
      )}
    </div>
  );
}
