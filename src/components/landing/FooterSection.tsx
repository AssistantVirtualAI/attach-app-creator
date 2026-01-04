import { motion } from "framer-motion";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { AvaLogo } from "@/components/shared/AvaLogo";
import { useTranslation } from "@/hooks/useTranslation";

const socialLinks = [
  { icon: Twitter, href: "#", label: "Twitter" },
  { icon: Github, href: "#", label: "GitHub" },
  { icon: Linkedin, href: "#", label: "LinkedIn" },
  { icon: Mail, href: "mailto:contact@example.com", label: "Email" },
];

export const FooterSection = () => {
  const { t } = useTranslation();

  return (
    <footer className="relative pt-24 pb-12 bg-gradient-to-b from-background to-card/50 border-t border-border/50">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-12 mb-16">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-6"
            >
              <AvaLogo size="sm" animated={false} />
            </motion.div>
            <p className="text-muted-foreground mb-6">
              {t('footer.description')}
            </p>
            {/* Social links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-xl bg-muted/50 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Product column */}
          <div>
            <h4 className="font-semibold mb-4">{t('footer.product')}</h4>
            <ul className="space-y-3">
              <li>
                <Link to="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.features')}
                </Link>
              </li>
              <li>
                <Link to="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.pricing')}
                </Link>
              </li>
              <li>
                <Link to="#integrations" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.integrations')}
                </Link>
              </li>
              <li>
                <Link to="#changelog" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.changelog')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div>
            <h4 className="font-semibold mb-4">{t('footer.company')}</h4>
            <ul className="space-y-3">
              <li>
                <Link to="#about" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.about')}
                </Link>
              </li>
              <li>
                <Link to="#blog" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.blog')}
                </Link>
              </li>
              <li>
                <Link to="#careers" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.careers')}
                </Link>
              </li>
              <li>
                <Link to="#contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="font-semibold mb-4">{t('footer.legal')}</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link to="/legal" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.terms')}
                </Link>
              </li>
              <li>
                <Link to="#cookies" className="text-muted-foreground hover:text-foreground transition-colors">
                  {t('footer.cookies')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4"
        >
          <p className="text-sm text-muted-foreground">
            {t('footer.copyright')}
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              All systems operational
            </span>
          </div>
        </motion.div>
      </div>
    </footer>
  );
};
