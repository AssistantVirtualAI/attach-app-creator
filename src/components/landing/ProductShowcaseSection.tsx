import { motion } from "framer-motion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Phone, BarChart3, Bot } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

const SlideShell = ({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) => {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/50 backdrop-blur-xl overflow-hidden">
      <div className="p-6 md:p-8 border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-xl shadow-primary/20">
            <Icon className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-1">{title}</h3>
            <p className="text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-6 md:p-8">{children}</div>
    </div>
  );
};

export const ProductShowcaseSection = () => {
  const { t } = useTranslation();

  const slides = [
    {
      key: "agent",
      title: t("landing.showcase.agent.title"),
      subtitle: t("landing.showcase.agent.subtitle"),
      icon: Bot,
      body: (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
            <div className="text-sm text-muted-foreground mb-3">{t("landing.showcase.agent.panel1Title")}</div>
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-3 rounded-full bg-muted/70" style={{ width: `${88 - i * 10}%` }} />
              ))}
              <div className="h-10 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-border/60" />
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
            <div className="text-sm text-muted-foreground mb-3">{t("landing.showcase.agent.panel2Title")}</div>
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t("landing.showcase.agent.voiceLabel")}</span>
                  <Badge variant="secondary">{t("landing.showcase.agent.preview")}</Badge>
                </div>
                <div className="mt-3 h-2 rounded-full bg-muted/70" />
              </div>
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="text-sm text-muted-foreground">{t("landing.showcase.agent.sync")}</div>
                <div className="mt-2 h-2 rounded-full bg-primary/30" />
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "twilio",
      title: t("landing.showcase.twilio.title"),
      subtitle: t("landing.showcase.twilio.subtitle"),
      icon: Phone,
      body: (
        <div className="grid md:grid-cols-3 gap-4">
          {["numbers", "calls", "recordings"].map((k) => (
            <div
              key={k}
              className="rounded-2xl border border-border/60 bg-background/40 p-5"
            >
              <div className="text-sm font-medium mb-2">{t(`landing.showcase.twilio.${k}.title`)}</div>
              <p className="text-sm text-muted-foreground mb-4">{t(`landing.showcase.twilio.${k}.description`)}</p>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-3 rounded-full bg-muted/70" style={{ width: `${92 - i * 14}%` }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "analytics",
      title: t("landing.showcase.analytics.title"),
      subtitle: t("landing.showcase.analytics.subtitle"),
      icon: BarChart3,
      body: (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
            <div className="text-sm font-medium mb-3">{t("landing.showcase.analytics.panel1Title")}</div>
            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card/60 p-4">
                  <div className="h-3 rounded-full bg-muted/70 w-1/2 mb-3" />
                  <div className="h-7 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-background/40 p-5">
            <div className="text-sm font-medium mb-3">{t("landing.showcase.analytics.panel2Title")}</div>
            <div className="h-44 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 border border-border/60" />
            <div className="mt-4 flex flex-wrap gap-2">
              {["sentiment", "topics", "score"].map((k) => (
                <Badge key={k} variant="secondary">{t(`landing.showcase.analytics.${k}`)}</Badge>
              ))}
            </div>
          </div>
        </div>
      ),
    },
  ] as const;

  return (
    <section className="py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/5 to-background" />

      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge variant="secondary" className="gap-2 mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            {t("landing.showcase.badge")}
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">{t("landing.showcase.title")}</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t("landing.showcase.subtitle")}
          </p>
        </motion.div>

        <Carousel opts={{ align: "start" }} className="w-full">
          <CarouselContent>
            {slides.map((s) => (
              <CarouselItem key={s.key} className="md:basis-full">
                <SlideShell title={s.title} subtitle={s.subtitle} icon={s.icon}>
                  {s.body}
                </SlideShell>
              </CarouselItem>
            ))}
          </CarouselContent>
          <div className="mt-6 flex justify-center gap-3">
            <CarouselPrevious />
            <CarouselNext />
          </div>
        </Carousel>
      </div>
    </section>
  );
};
