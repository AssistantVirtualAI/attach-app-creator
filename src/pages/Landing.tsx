import { motion } from "framer-motion";
import { Navbar } from "@/components/landing/Navbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustedBySection } from "@/components/landing/TrustedBySection";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { PortalComparisonSection } from "@/components/landing/PortalComparisonSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { CTASection } from "@/components/landing/CTASection";
import { FooterSection } from "@/components/landing/FooterSection";
import { AgentCreationSection } from "@/components/landing/AgentCreationSection";
import { IntegrationsSection } from "@/components/landing/IntegrationsSection";
import { ProductShowcaseSection } from "@/components/landing/ProductShowcaseSection";
import { AllFeaturesSummarySection } from "@/components/landing/AllFeaturesSummarySection";

const Landing = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <HeroSection />
        <TrustedBySection />
        <div id="how-it-works">
          <HowItWorksSection />
        </div>
        <div id="agent-creation">
          <AgentCreationSection />
        </div>
        <div id="features">
          <FeaturesSection />
        </div>
        <div id="feature-list">
          <AllFeaturesSummarySection />
        </div>
        <div id="portals">
          <PortalComparisonSection />
        </div>
        <div id="integrations">
          <IntegrationsSection />
        </div>
        <div id="analytics">
          <ProductShowcaseSection />
        </div>
        <div id="testimonials">
          <TestimonialsSection />
        </div>
        <div id="faq">
          <FAQSection />
        </div>
        <div id="pricing">
          <PricingSection />
        </div>
        <CTASection />
        <FooterSection />
      </motion.div>
    </div>
  );
};

export default Landing;
