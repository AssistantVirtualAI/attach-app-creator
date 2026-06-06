import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import logoImage from '@/assets/ava-statistics-logo.png';

interface AvaStatisticsLogoProps {
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  showText?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: { container: 'h-8 gap-2', icon: 'h-10 w-10', iconContainer: 'w-10 h-10', text: 'text-lg', subtitle: 'text-[8px]' },
  md: { container: 'h-10 gap-2.5', icon: 'h-12 w-12', iconContainer: 'w-12 h-12', text: 'text-xl', subtitle: 'text-[10px]' },
  lg: { container: 'h-16 gap-3', icon: 'h-16 w-16', iconContainer: 'w-16 h-16', text: 'text-3xl', subtitle: 'text-xs' },
};

export function AvaStatisticsLogo({ size = 'md', animated = true, showText = true, className }: AvaStatisticsLogoProps) {
  const sizes = sizeClasses[size];

  return (
    <div className={cn('flex items-center', sizes.container, className)}>
      <motion.div
        initial={{ scale: 1, rotate: 0 }}
        animate={animated ? { scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] } : undefined}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className={cn(sizes.iconContainer, 'overflow-hidden rounded-xl')}
      >
        <img src={logoImage} alt="AVA Statistics" className={cn(sizes.icon, 'object-cover')} />
      </motion.div>

      {showText && (
        <div className="flex flex-col">
          <span className={cn(sizes.text, 'font-black tracking-tight text-[#8B5CF6]')}>AVA</span>
          <span className={cn(sizes.subtitle, 'font-medium tracking-widest uppercase -mt-1 text-[#8B5CF6]')}>
            Statistics
          </span>
        </div>
      )}
    </div>
  );
}
