import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { AvaLogo } from '@/components/shared/AvaLogo';
import { useNavigate } from 'react-router-dom';
import { Menu, X, Globe } from 'lucide-react';
import { useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from '@/hooks/useTranslation';

export const Navbar = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();

  const navLinks = [
    { label: t('nav.features'), href: '#features' },
    { label: t('nav.testimonials'), href: '#testimonials' },
    { label: t('nav.pricing'), href: '#pricing' },
  ];

  const scrollToSection = (href: string) => {
    setIsMobileMenuOpen(false);
    if (href.startsWith('#')) {
      const element = document.querySelector(href);
      element?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50"
    >
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <AvaLogo size="sm" animated={false} />

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollToSection(link.href)}
                className="text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Desktop CTA + Language */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              className="flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              <span className="font-medium">{language.toUpperCase()}</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => navigate('/login')}
            >
              {t('nav.login')}
            </Button>
            <Button
              className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              onClick={() => navigate('/login')}
            >
              {t('nav.getStarted')}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
            >
              <Globe className="w-4 h-4" />
              <span className="ml-1 font-medium">{language.toUpperCase()}</span>
            </Button>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border"
        >
          <div className="container mx-auto px-6 py-4 space-y-4">
            {navLinks.map((link) => (
              <button
                key={link.label}
                onClick={() => scrollToSection(link.href)}
                className="block w-full text-left text-muted-foreground hover:text-foreground transition-colors font-medium py-2"
              >
                {link.label}
              </button>
            ))}
            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate('/login')}
              >
                {t('nav.login')}
              </Button>
              <Button
                className="w-full bg-gradient-to-r from-primary to-secondary"
                onClick={() => navigate('/login')}
              >
                {t('nav.getStarted')}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.header>
  );
};
