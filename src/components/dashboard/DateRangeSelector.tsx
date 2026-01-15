import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export type PeriodPreset = 'today' | '7days' | '30days' | 'thisWeek' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRangeSelectorProps {
  value: { start: Date; end: Date } | null;
  onChange: (range: { start: Date; end: Date }) => void;
  className?: string;
  showQuickButtons?: boolean;
}

export const DateRangeSelector = ({ 
  value, 
  onChange, 
  className,
  showQuickButtons = true 
}: DateRangeSelectorProps) => {
  const [preset, setPreset] = useState<PeriodPreset>('7days');
  const [isCustomOpen, setIsCustomOpen] = useState(false);

  const handlePresetChange = (newPreset: PeriodPreset) => {
    setPreset(newPreset);
    const now = new Date();
    
    switch (newPreset) {
      case 'today':
        onChange({ start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() });
        break;
      case '7days':
        onChange({ start: subDays(new Date(), 7), end: new Date() });
        break;
      case '30days':
        onChange({ start: subDays(new Date(), 30), end: new Date() });
        break;
      case 'thisWeek':
        onChange({ start: startOfWeek(now, { locale: fr }), end: endOfWeek(now, { locale: fr }) });
        break;
      case 'thisMonth':
        onChange({ start: startOfMonth(now), end: endOfMonth(now) });
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        onChange({ start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) });
        break;
      case 'custom':
        setIsCustomOpen(true);
        break;
    }
  };

  const quickButtons = [
    { id: '7days' as PeriodPreset, label: '7j' },
    { id: '30days' as PeriodPreset, label: '30j' },
    { id: 'thisMonth' as PeriodPreset, label: 'Ce mois' },
    { id: 'lastMonth' as PeriodPreset, label: 'Mois -1' },
  ];

  const getPresetLabel = () => {
    switch (preset) {
      case 'today': return "Aujourd'hui";
      case '7days': return '7 derniers jours';
      case '30days': return '30 derniers jours';
      case 'thisWeek': return 'Cette semaine';
      case 'thisMonth': return 'Ce mois';
      case 'lastMonth': return 'Mois dernier';
      case 'custom': 
        return value 
          ? `${format(value.start, 'dd/MM', { locale: fr })} - ${format(value.end, 'dd/MM', { locale: fr })}`
          : 'Personnalisé';
      default: return 'Période';
    }
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* Quick Buttons */}
      {showQuickButtons && (
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50">
          {quickButtons.map((btn) => (
            <motion.button
              key={btn.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePresetChange(btn.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                preset === btn.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {btn.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Custom Date Picker */}
      <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant={preset === 'custom' ? 'default' : 'outline'} 
            size="sm"
            className="gap-2"
            onClick={() => {
              setPreset('custom');
              setIsCustomOpen(true);
            }}
          >
            <CalendarIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{getPresetLabel()}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b">
            <p className="text-sm font-medium">Période personnalisée</p>
            <p className="text-xs text-muted-foreground">Sélectionnez une plage de dates</p>
          </div>
          <div className="flex gap-2 p-4">
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Du</p>
              <Calendar
                mode="single"
                selected={value?.start}
                onSelect={(date) => {
                  if (date) {
                    onChange({ 
                      start: date, 
                      end: value?.end && date <= value.end ? value.end : date 
                    });
                  }
                }}
                locale={fr}
                className="pointer-events-auto"
              />
            </div>
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Au</p>
              <Calendar
                mode="single"
                selected={value?.end}
                onSelect={(date) => {
                  if (date) {
                    onChange({ 
                      start: value?.start && date >= value.start ? value.start : date, 
                      end: date 
                    });
                  }
                }}
                locale={fr}
                disabled={(date) => value?.start ? date < value.start : false}
                className="pointer-events-auto"
              />
            </div>
          </div>
          <div className="border-t p-3 flex justify-between items-center bg-muted/30">
            <div className="text-xs text-muted-foreground">
              {value && (
                <>
                  {format(value.start, 'dd MMM yyyy', { locale: fr })} →{' '}
                  {format(value.end, 'dd MMM yyyy', { locale: fr })}
                </>
              )}
            </div>
            <Button size="sm" onClick={() => setIsCustomOpen(false)}>
              Appliquer
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
