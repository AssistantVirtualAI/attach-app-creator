import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

// Inline SVG logos — source: official brand assets / Wikimedia Commons
const ElevenLabsLogo = () => (
  <svg viewBox="0 0 48 48" fill="currentColor" className="w-full h-full">
    {/* || ElevenLabs wordmark icon — two vertical bars */}
    <rect x="10" y="8" width="10" height="32" rx="2" />
    <rect x="28" y="8" width="10" height="32" rx="2" />
  </svg>
);

const VapiLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
    <path d="M24 6L42 38H6L24 6Z" fill="currentColor" opacity="0.9" />
    <path d="M24 14L36 36H12L24 14Z" fill="white" opacity="0.25" />
  </svg>
);

const RetellLogo = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-full h-full">
    <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="3.5" fill="none" />
    <path d="M16 24C16 19.6 19.6 16 24 16V32C19.6 32 16 28.4 16 24Z" fill="currentColor" />
    <circle cx="24" cy="24" r="4" fill="currentColor" />
  </svg>
);

const OpenAILogo = () => (
  <svg viewBox="0 0 48 48" fill="currentColor" className="w-full h-full">
    <path d="M40.9 19.5c.9-2.7.6-5.7-.9-8.1-2.3-3.6-6.4-5.4-10.5-4.6C27.8 4.6 25.2 3 22.4 3c-4.2 0-7.9 2.7-9.2 6.7C10.4 10.3 8 12.4 7 15.1c-1.5 3.6-.7 7.8 2 10.5-.9 2.7-.6 5.7.9 8.1 2.3 3.6 6.4 5.4 10.5 4.6 1.7 2.2 4.3 3.6 7.1 3.6 4.2 0 7.9-2.7 9.2-6.7 2.8-.7 5.2-2.7 6.3-5.5 1.5-3.5.7-7.7-2.1-10.2zM30.5 39.3c-1.6 0-3.1-.5-4.3-1.5l.2-.1 7.2-4.2c.4-.2.6-.6.6-1v-10l3 1.7v10.2c0 2.7-2.2 4.9-4.7 4.9zM10.4 32.3c-.8-1.4-1.1-3-.8-4.6l.2.1 7.2 4.2c.4.2.8.2 1.2 0l8.8-5.1v3.4l-7.3 4.2c-2.4 1.3-5.4.6-7.3-2.2zM8.4 16.7c.8-1.4 2-2.5 3.5-3.1v8.6c0 .4.2.8.6 1l8.8 5.1-3 1.7L10.8 26c-2.3-1.4-3.2-4.4-2.4-7.2-.1-.1-.1 0 0-.1zM37.6 25.1l-8.8-5.1 3-1.7 7.5 4.3c2.3 1.4 3.2 4.4 2.4 7.2-.8 1.4-2 2.5-3.5 3.1V24c0-.4-.2-.8-.6-.9zm3-7.4l-.2-.1-7.2-4.2c-.4-.2-.8-.2-1.2 0l-8.8 5.1V15l7.3-4.2c2.4-1.3 5.4-.6 7.3 2.2.8 1.4 1.1 3 .8 4.7zM19.5 26.2l-3-1.7V15c0-2.7 2.2-4.9 4.8-4.9 1.6 0 3.1.6 4.2 1.5l-.2.1-7.2 4.2c-.4.2-.6.6-.6 1v10zm1.6-3.6l3.9-2.3 3.9 2.3v4.5l-3.9 2.3-3.9-2.3v-4.5z" />
  </svg>
);

const TwilioLogo = () => (
  <svg viewBox="0 0 48 48" fill="currentColor" className="w-full h-full">
    <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3" />
    <circle cx="16.5" cy="16.5" r="3.5" />
    <circle cx="31.5" cy="16.5" r="3.5" />
    <circle cx="16.5" cy="31.5" r="3.5" />
    <circle cx="31.5" cy="31.5" r="3.5" />
  </svg>
);

const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" className="w-full h-full">
    <path fill="#4285F4" d="M43.6 24.5c0-1.6-.1-2.8-.4-4H24v7.3h11c-.5 2.5-1.9 4.6-4 6v5h6.4c3.7-3.4 5.9-8.5 5.9-14.3z" />
    <path fill="#34A853" d="M24 44c5.4 0 9.9-1.8 13.2-4.8l-6.4-5c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.1v5.1C8.4 39.4 15.7 44 24 44z" />
    <path fill="#FBBC05" d="M12.8 28c-.4-1.2-.6-2.5-.6-3.9s.2-2.7.6-3.9v-5.1H5.1C3.8 17.5 3 20.6 3 24s.8 6.5 2.1 8.9l7.7-4.9z" />
    <path fill="#EA4335" d="M24 11.9c2.9 0 5.5 1 7.5 2.9l5.6-5.6C33.9 5.8 29.4 4 24 4 15.7 4 8.4 8.6 5.1 15.2l7.7 4.9c1.6-4.7 6-8.2 11.2-8.2z" />
  </svg>
);

const logos = [
  {
    name: 'ElevenLabs',
    Logo: ElevenLabsLogo,
    bg: 'bg-black',
    color: 'text-white',
  },
  {
    name: 'Vapi',
    Logo: VapiLogo,
    bg: 'bg-[#1a1a2e]',
    color: 'text-[#7c6eff]',
  },
  {
    name: 'Retell AI',
    Logo: RetellLogo,
    bg: 'bg-[#0d1117]',
    color: 'text-[#58a6ff]',
  },
  {
    name: 'OpenAI',
    Logo: OpenAILogo,
    bg: 'bg-black',
    color: 'text-white',
  },
  {
    name: 'Twilio',
    Logo: TwilioLogo,
    bg: 'bg-[#f22f46]',
    color: 'text-white',
  },
  {
    name: 'Google',
    Logo: GoogleLogo,
    bg: 'bg-white',
    color: 'text-foreground',
  },
];

export const TrustedBySection = () => {
  const { t } = useTranslation();

  return (
    <section className="py-12 relative overflow-hidden border-y border-border/30 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-muted-foreground mb-8 tracking-widest uppercase"
        >
          {t('trustedBy.title')}
        </motion.p>

        {/* Marquee effect */}
        <div className="relative">
          <div className="flex gap-12 animate-marquee">
            {[...logos, ...logos].map((logo, index) => {
              const { Logo } = logo;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: (index % logos.length) * 0.1 }}
                  className="flex items-center gap-3 min-w-fit"
                >
                  <div
                    className={`w-8 h-8 rounded-lg ${logo.bg} ${logo.color} flex items-center justify-center shadow-md p-1.5 flex-shrink-0`}
                  >
                    <Logo />
                  </div>
                  <span className="text-base font-semibold text-muted-foreground whitespace-nowrap">
                    {logo.name}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gradient overlays for fade effect */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
    </section>
  );
};
