import { motion } from 'framer-motion';
import { useTranslation } from '@/hooks/useTranslation';

const logos = [
  { name: 'ElevenLabs', color: 'from-blue-500 to-cyan-500' },
  { name: 'Vapi', color: 'from-purple-500 to-pink-500' },
  { name: 'Retell AI', color: 'from-orange-500 to-amber-500' },
  { name: 'OpenAI', color: 'from-green-500 to-emerald-500' },
  { name: 'Twilio', color: 'from-red-500 to-rose-500' },
  { name: 'Google', color: 'from-blue-400 to-indigo-500' },
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
          className="text-center text-sm text-muted-foreground mb-8"
        >
          {t('trustedBy.title')}
        </motion.p>

        {/* Marquee effect */}
        <div className="relative">
          <div className="flex gap-12 animate-marquee">
            {[...logos, ...logos].map((logo, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: (index % logos.length) * 0.1 }}
                className="flex items-center gap-2 min-w-fit"
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${logo.color} flex items-center justify-center shadow-md`}>
                  <span className="text-white font-bold text-sm">{logo.name[0]}</span>
                </div>
                <span className="text-lg font-semibold text-muted-foreground whitespace-nowrap">
                  {logo.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Gradient overlays for fade effect */}
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />
    </section>
  );
};
