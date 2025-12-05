import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Mail, Globe, Calendar } from 'lucide-react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-2">Politique de Confidentialité</h1>
          <p className="text-muted-foreground flex items-center justify-center gap-2">
            <Calendar className="w-4 h-4" />
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Collecte des données</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>
              Nous collectons les informations que vous nous fournissez directement, notamment :
            </p>
            <ul>
              <li>Informations de compte (nom, email, mot de passe)</li>
              <li>Informations de profil (avatar, préférences)</li>
              <li>Données de conversation avec les agents IA</li>
              <li>Informations de paiement (via notre prestataire Stripe)</li>
              <li>Données d'utilisation et logs techniques</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Utilisation des données</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>Vos données sont utilisées pour :</p>
            <ul>
              <li>Fournir et améliorer nos services</li>
              <li>Personnaliser votre expérience</li>
              <li>Traiter vos paiements et gérer votre abonnement</li>
              <li>Vous envoyer des communications importantes</li>
              <li>Analyser l'utilisation de nos services (si vous y consentez)</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Partage des données</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>Nous ne vendons jamais vos données personnelles. Nous pouvons les partager avec :</p>
            <ul>
              <li>Nos prestataires de services (hébergement, paiement, analytics)</li>
              <li>En cas d'obligation légale ou judiciaire</li>
              <li>Avec votre consentement explicite</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Vos droits (RGPD)</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul>
              <li><strong>Droit d'accès :</strong> Obtenir une copie de vos données</li>
              <li><strong>Droit de rectification :</strong> Corriger vos données inexactes</li>
              <li><strong>Droit à l'effacement :</strong> Demander la suppression de vos données</li>
              <li><strong>Droit à la portabilité :</strong> Recevoir vos données dans un format structuré</li>
              <li><strong>Droit d'opposition :</strong> Vous opposer au traitement de vos données</li>
              <li><strong>Droit de limitation :</strong> Limiter le traitement de vos données</li>
            </ul>
            <p>
              Pour exercer ces droits, rendez-vous dans Paramètres &gt; Confidentialité ou contactez-nous.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Sécurité</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>Nous mettons en œuvre des mesures de sécurité appropriées :</p>
            <ul>
              <li>Chiffrement des données au repos (AES-256)</li>
              <li>Chiffrement des communications (TLS 1.3)</li>
              <li>Authentification sécurisée avec 2FA disponible</li>
              <li>Journaux d'audit pour les comptes HIPAA</li>
              <li>Sauvegardes régulières et géographiquement distribuées</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>6. Cookies</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>Nous utilisons différents types de cookies :</p>
            <ul>
              <li><strong>Essentiels :</strong> Nécessaires au fonctionnement du site</li>
              <li><strong>Analytiques :</strong> Pour comprendre l'utilisation (avec consentement)</li>
              <li><strong>Marketing :</strong> Pour personnaliser les publicités (avec consentement)</li>
            </ul>
            <p>Vous pouvez gérer vos préférences de cookies à tout moment.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>7. Contact</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>Pour toute question concernant cette politique ou vos données :</p>
            <div className="flex flex-col gap-2 mt-4">
              <a href="mailto:privacy@example.com" className="flex items-center gap-2 text-primary hover:underline">
                <Mail className="w-4 h-4" />
                privacy@example.com
              </a>
              <a href="https://example.com" className="flex items-center gap-2 text-primary hover:underline">
                <Globe className="w-4 h-4" />
                www.example.com
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
