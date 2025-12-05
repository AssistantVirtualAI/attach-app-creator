import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
] as const;

interface LanguageSelectorProps {
  variant?: 'select' | 'buttons' | 'dropdown';
  showLabel?: boolean;
  className?: string;
}

export const LanguageSelector = ({ 
  variant = 'select', 
  showLabel = true,
  className 
}: LanguageSelectorProps) => {
  const [currentLang, setCurrentLang] = useState(() => {
    return localStorage.getItem('app-language') || 'fr';
  });

  const handleLanguageChange = async (lang: string) => {
    setCurrentLang(lang);
    localStorage.setItem('app-language', lang);
    
    // Save to profile if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('profiles')
        .update({ locale: lang })
        .eq('id', user.id);
    }
    
    // Reload to apply language changes
    window.location.reload();
  };

  if (variant === 'buttons') {
    return (
      <div className={className}>
        {showLabel && (
          <p className="text-sm font-medium mb-2">Langue</p>
        )}
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <Button
              key={lang.code}
              variant={currentLang === lang.code ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleLanguageChange(lang.code)}
              className="gap-2"
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <Select value={currentLang} onValueChange={handleLanguageChange}>
        <SelectTrigger className={className || "w-[50px]"}>
          <span className="text-lg">
            {SUPPORTED_LANGUAGES.find(l => l.code === currentLang)?.flag || '🌐'}
          </span>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className={className}>
      {showLabel && (
        <p className="text-sm font-medium mb-2 flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Langue
        </p>
      )}
      <Select value={currentLang} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Sélectionner la langue" />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
