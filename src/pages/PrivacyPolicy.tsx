import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Mail, Globe, Calendar } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { FooterSection } from '@/components/landing/FooterSection';
import { useTranslation } from '@/hooks/useTranslation';

const PrivacyPolicy = () => {
  const { t, language } = useTranslation();

  const content = language === 'fr' ? {
    title: 'Politique de Confidentialité',
    lastUpdated: 'Dernière mise à jour',
    sections: [
      {
        title: '1. Collecte des données',
        body: 'Nous collectons les informations que vous nous fournissez directement, notamment :',
        items: [
          'Informations de compte (nom, email, mot de passe)',
          'Informations de profil (avatar, préférences)',
          'Données de conversation avec les agents IA',
          'Informations de paiement (via notre prestataire Stripe)',
          "Données d'utilisation et logs techniques",
        ],
      },
      {
        title: '2. Utilisation des données',
        body: 'Vos données sont utilisées pour :',
        items: [
          'Fournir et améliorer nos services',
          'Personnaliser votre expérience',
          'Traiter vos paiements et gérer votre abonnement',
          'Vous envoyer des communications importantes',
          "Analyser l'utilisation de nos services (si vous y consentez)",
          'Respecter nos obligations légales',
        ],
      },
      {
        title: '3. Partage des données',
        body: 'Nous ne vendons jamais vos données personnelles. Nous pouvons les partager avec :',
        items: [
          'Nos prestataires de services (hébergement, paiement, analytics)',
          'En cas d\'obligation légale ou judiciaire',
          'Avec votre consentement explicite',
        ],
      },
      {
        title: '4. Vos droits (RGPD)',
        body: 'Conformément au RGPD, vous disposez des droits suivants :',
        items: [
          'Droit d\'accès : Obtenir une copie de vos données',
          'Droit de rectification : Corriger vos données inexactes',
          'Droit à l\'effacement : Demander la suppression de vos données',
          'Droit à la portabilité : Recevoir vos données dans un format structuré',
          'Droit d\'opposition : Vous opposer au traitement de vos données',
          'Droit de limitation : Limiter le traitement de vos données',
        ],
        footer: 'Pour exercer ces droits, rendez-vous dans Paramètres > Confidentialité ou contactez-nous.',
      },
      {
        title: '5. Sécurité',
        body: 'Nous mettons en œuvre des mesures de sécurité appropriées :',
        items: [
          'Chiffrement des données au repos (AES-256)',
          'Chiffrement des communications (TLS 1.3)',
          'Authentification sécurisée avec 2FA disponible',
          'Journaux d\'audit pour les comptes HIPAA',
          'Sauvegardes régulières et géographiquement distribuées',
        ],
      },
      {
        title: '6. Cookies',
        body: 'Nous utilisons différents types de cookies :',
        items: [
          'Essentiels : Nécessaires au fonctionnement du site',
          'Analytiques : Pour comprendre l\'utilisation (avec consentement)',
          'Marketing : Pour personnaliser les publicités (avec consentement)',
        ],
        footer: 'Vous pouvez gérer vos préférences de cookies à tout moment.',
      },
      {
        title: '7. Contact',
        body: 'Pour toute question concernant cette politique ou vos données :',
      },
    ],
  } : {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated',
    sections: [
      {
        title: '1. Data Collection',
        body: 'We collect information you provide directly, including:',
        items: [
          'Account information (name, email, password)',
          'Profile information (avatar, preferences)',
          'Conversation data with AI agents',
          'Payment information (via our provider Stripe)',
          'Usage data and technical logs',
        ],
      },
      {
        title: '2. Data Usage',
        body: 'Your data is used to:',
        items: [
          'Provide and improve our services',
          'Personalize your experience',
          'Process payments and manage your subscription',
          'Send you important communications',
          'Analyze service usage (with your consent)',
          'Comply with legal obligations',
        ],
      },
      {
        title: '3. Data Sharing',
        body: 'We never sell your personal data. We may share it with:',
        items: [
          'Service providers (hosting, payment, analytics)',
          'In case of legal or judicial obligation',
          'With your explicit consent',
        ],
      },
      {
        title: '4. Your Rights (GDPR)',
        body: 'Under GDPR, you have the following rights:',
        items: [
          'Right of access: Obtain a copy of your data',
          'Right to rectification: Correct inaccurate data',
          'Right to erasure: Request deletion of your data',
          'Right to portability: Receive your data in a structured format',
          'Right to object: Object to the processing of your data',
          'Right to restriction: Limit the processing of your data',
        ],
        footer: 'To exercise these rights, go to Settings > Privacy or contact us.',
      },
      {
        title: '5. Security',
        body: 'We implement appropriate security measures:',
        items: [
          'Encryption at rest (AES-256)',
          'Communication encryption (TLS 1.3)',
          'Secure authentication with 2FA available',
          'Audit logs for HIPAA accounts',
          'Regular and geographically distributed backups',
        ],
      },
      {
        title: '6. Cookies',
        body: 'We use different types of cookies:',
        items: [
          'Essential: Required for the site to function',
          'Analytics: To understand usage (with consent)',
          'Marketing: To personalize ads (with consent)',
        ],
        footer: 'You can manage your cookie preferences at any time.',
      },
      {
        title: '7. Contact',
        body: 'For any questions about this policy or your data:',
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <Navbar />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-2">{content.title}</h1>
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              <Calendar className="w-4 h-4" />
              {content.lastUpdated} : {new Date().toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-US')}
            </p>
          </div>

          {content.sections.map((section, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <p>{section.body}</p>
                {section.items && (
                  <ul>
                    {section.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {'footer' in section && section.footer && <p>{section.footer}</p>}
                {idx === content.sections.length - 1 && (
                  <div className="flex flex-col gap-2 mt-4">
                    <a href="mailto:privacy@avastatistics.com" className="flex items-center gap-2 text-primary hover:underline">
                      <Mail className="w-4 h-4" />
                      privacy@avastatistics.com
                    </a>
                    <a href="https://avastatistics.com" className="flex items-center gap-2 text-primary hover:underline">
                      <Globe className="w-4 h-4" />
                      www.avastatistics.com
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <FooterSection />
    </div>
  );
};

export default PrivacyPolicy;
