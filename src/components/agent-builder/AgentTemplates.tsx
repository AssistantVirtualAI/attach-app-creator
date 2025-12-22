import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Headphones, Calendar, ShoppingCart, MessageSquare, Users, Sparkles } from 'lucide-react';

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  systemPrompt: string;
  firstMessage: string;
  temperature: number;
  maxTokens: number;
  tags: string[];
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'customer-support',
    name: 'Support Client',
    description: 'Agent spécialisé dans le support client, la gestion des FAQ et la résolution de problèmes.',
    icon: <Headphones className="h-6 w-6" />,
    color: 'from-blue-500 to-cyan-500',
    systemPrompt: `Tu es un agent de support client professionnel et empathique. Tu dois:
- Répondre aux questions des clients de manière claire et concise
- Résoudre les problèmes avec patience et efficacité
- Escalader vers un humain si nécessaire
- Toujours rester courtois et professionnel
- Proposer des solutions alternatives quand c'est possible`,
    firstMessage: 'Bonjour ! Je suis votre assistant support. Comment puis-je vous aider aujourd\'hui ?',
    temperature: 0.7,
    maxTokens: 150,
    tags: ['Support', 'FAQ', 'Service client'],
  },
  {
    id: 'appointment-booking',
    name: 'Prise de Rendez-vous',
    description: 'Agent pour gérer les réservations, disponibilités et rappels de rendez-vous.',
    icon: <Calendar className="h-6 w-6" />,
    color: 'from-purple-500 to-pink-500',
    systemPrompt: `Tu es un assistant de prise de rendez-vous. Tes responsabilités:
- Aider les utilisateurs à trouver des créneaux disponibles
- Confirmer et rappeler les rendez-vous
- Gérer les modifications et annulations
- Collecter les informations nécessaires (nom, email, téléphone)
- Être efficace et aller droit au but`,
    firstMessage: 'Bonjour ! Je peux vous aider à prendre rendez-vous. Quel service vous intéresse ?',
    temperature: 0.5,
    maxTokens: 120,
    tags: ['Calendrier', 'Réservation', 'Planning'],
  },
  {
    id: 'sales-assistant',
    name: 'Assistant Commercial',
    description: 'Agent de vente pour conseiller les clients et recommander des produits.',
    icon: <ShoppingCart className="h-6 w-6" />,
    color: 'from-green-500 to-emerald-500',
    systemPrompt: `Tu es un assistant commercial expert. Tu dois:
- Comprendre les besoins des clients
- Recommander des produits/services adaptés
- Répondre aux questions sur les prix et disponibilités
- Mettre en avant les avantages et promotions
- Guider vers l'achat sans être trop insistant`,
    firstMessage: 'Bienvenue ! Je suis là pour vous aider à trouver ce qu\'il vous faut. Que recherchez-vous ?',
    temperature: 0.8,
    maxTokens: 180,
    tags: ['Vente', 'E-commerce', 'Conseil'],
  },
  {
    id: 'lead-qualification',
    name: 'Qualification de Leads',
    description: 'Agent pour qualifier les prospects et collecter les informations importantes.',
    icon: <Users className="h-6 w-6" />,
    color: 'from-orange-500 to-amber-500',
    systemPrompt: `Tu es un agent de qualification de leads. Tes objectifs:
- Identifier les besoins et le budget du prospect
- Collecter les coordonnées (nom, email, téléphone, entreprise)
- Évaluer le niveau d'intérêt et d'urgence
- Qualifier le lead (chaud, tiède, froid)
- Transmettre les informations pour un suivi commercial`,
    firstMessage: 'Bonjour ! Je suis ravi de vous accueillir. Puis-je en savoir plus sur votre projet ?',
    temperature: 0.6,
    maxTokens: 150,
    tags: ['B2B', 'Prospection', 'CRM'],
  },
  {
    id: 'general-assistant',
    name: 'Assistant Général',
    description: 'Agent polyvalent pour des conversations ouvertes et de l\'assistance générale.',
    icon: <MessageSquare className="h-6 w-6" />,
    color: 'from-indigo-500 to-violet-500',
    systemPrompt: `Tu es un assistant virtuel polyvalent et amical. Tu dois:
- Répondre à une variété de questions
- Être conversationnel et naturel
- Fournir des informations précises et utiles
- Rediriger vers les ressources appropriées si besoin
- Maintenir une conversation fluide et agréable`,
    firstMessage: 'Bonjour ! Je suis votre assistant virtuel. Comment puis-je vous aider ?',
    temperature: 0.7,
    maxTokens: 150,
    tags: ['Polyvalent', 'Chat', 'Info'],
  },
];

interface AgentTemplatesProps {
  onSelectTemplate: (template: AgentTemplate) => void;
  selectedTemplateId?: string;
}

export function AgentTemplates({ onSelectTemplate, selectedTemplateId }: AgentTemplatesProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {AGENT_TEMPLATES.map((template) => (
        <Card
          key={template.id}
          className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg ${
            selectedTemplateId === template.id
              ? 'ring-2 ring-primary shadow-lg'
              : 'hover:ring-1 hover:ring-muted-foreground/20'
          }`}
          onClick={() => onSelectTemplate(template)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div
                className={`p-3 rounded-xl bg-gradient-to-br ${template.color} text-white shadow-md`}
              >
                {template.icon}
              </div>
              {selectedTemplateId === template.id && (
                <Badge variant="default" className="bg-primary">
                  Sélectionné
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg mt-3">{template.name}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {template.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Start Blank Card */}
      <Card
        className={`cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:shadow-lg border-dashed ${
          selectedTemplateId === 'blank'
            ? 'ring-2 ring-primary shadow-lg'
            : 'hover:ring-1 hover:ring-muted-foreground/20'
        }`}
        onClick={() =>
          onSelectTemplate({
            id: 'blank',
            name: 'Agent Personnalisé',
            description: 'Créez votre agent de zéro',
            icon: <Sparkles className="h-6 w-6" />,
            color: 'from-gray-500 to-slate-500',
            systemPrompt: '',
            firstMessage: '',
            temperature: 0.7,
            maxTokens: 150,
            tags: [],
          })
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="p-3 rounded-xl bg-gradient-to-br from-muted to-muted-foreground/20 text-muted-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            {selectedTemplateId === 'blank' && (
              <Badge variant="default" className="bg-primary">
                Sélectionné
              </Badge>
            )}
          </div>
          <CardTitle className="text-lg mt-3">Commencer de zéro</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Créez un agent entièrement personnalisé selon vos besoins.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs">
              Personnalisé
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
