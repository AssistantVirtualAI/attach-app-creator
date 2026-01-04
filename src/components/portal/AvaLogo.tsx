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
    text: 'text-lg',
    subtitle: 'text-[8px]',
  },
  md: {
    container: 'h-10 gap-2.5',
    icon: 'h-8 w-8',
    text: 'text-xl',
    subtitle: 'text-[10px]',
  },
  lg: {
    container: 'h-16 gap-3',
    icon: 'h-12 w-12',
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
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 blur-xl"
        />
        
        {/* Icon container */}
        <motion.div
          variants={iconVariants}
          initial="initial"
          animate={animated ? 'animate' : 'initial'}
          className="relative rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 p-1.5 shadow-lg"
        >
          <div className="rounded-lg bg-background/90 p-1">
            <BarChart3 className={cn(sizes.icon, 'text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text')} style={{ stroke: 'url(#gradient)' }} />
          </div>
        </motion.div>

        {/* SVG gradient for icon */}
        <svg width="0" height="0" className="absolute">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#ec4899" />
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
              'font-black tracking-tight bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent'
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
