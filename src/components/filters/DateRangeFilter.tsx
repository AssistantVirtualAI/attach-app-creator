import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { fr, en, es, de } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

export type DateRangePreset = 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth' | 'custom';

interface DateRangeFilterProps {
  value: { start: Date; end: Date } | null;
  onChange: (range: { start: Date; end: Date } | null) => void;
  className?: string;
}

const getLocale = (lang: string) => {
  switch (lang) {
    case 'en': return en;
    case 'es': return es;
    case 'de': return de;
    default: return fr;
  }
};

export const DateRangeFilter = ({ value, onChange, className }: DateRangeFilterProps) => {
  const { t, i18n } = useTranslation();
  const [preset, setPreset] = useState<DateRangePreset>('7days');
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const locale = getLocale(i18n.language);

  const handlePresetChange = (newPreset: DateRangePreset) => {
    setPreset(newPreset);
    const now = new Date();
    
    switch (newPreset) {
      case 'today':
        onChange({ start: new Date(now.setHours(0, 0, 0, 0)), end: new Date() });
        break;
      case '7days':
        onChange({ start: subDays(now, 7), end: new Date() });
        break;
      case '30days':
        onChange({ start: subDays(now, 30), end: new Date() });
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

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Select value={preset} onValueChange={(v) => handlePresetChange(v as DateRangePreset)}>
        <SelectTrigger className="w-[180px]">
          <CalendarIcon className="h-4 w-4 mr-2" />
          <SelectValue placeholder={t('filters.dateRange')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">{t('filters.today')}</SelectItem>
          <SelectItem value="7days">{t('filters.last7Days')}</SelectItem>
          <SelectItem value="30days">{t('filters.last30Days')}</SelectItem>
          <SelectItem value="thisMonth">{t('filters.thisMonth')}</SelectItem>
          <SelectItem value="lastMonth">{t('filters.lastMonth')}</SelectItem>
          <SelectItem value="custom">{t('filters.custom')}</SelectItem>
        </SelectContent>
      </Select>

      {preset === 'custom' && (
        <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              {value ? (
                <>
                  {format(value.start, 'dd/MM/yyyy', { locale })} - {format(value.end, 'dd/MM/yyyy', { locale })}
                </>
              ) : (
                t('filters.custom')
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex gap-2 p-4">
              <div>
                <p className="text-sm font-medium mb-2">{t('filters.from')}</p>
                <Calendar
                  mode="single"
                  selected={value?.start}
                  onSelect={(date) => {
                    if (date) {
                      onChange({ 
                        start: date, 
                        end: value?.end || new Date() 
                      });
                    }
                  }}
                  locale={locale}
                />
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t('filters.to')}</p>
                <Calendar
                  mode="single"
                  selected={value?.end}
                  onSelect={(date) => {
                    if (date) {
                      onChange({ 
                        start: value?.start || date, 
                        end: date 
                      });
                    }
                  }}
                  locale={locale}
                />
              </div>
            </div>
            <div className="border-t p-2 flex justify-end">
              <Button size="sm" onClick={() => setIsCustomOpen(false)}>
                {t('filters.apply')}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
