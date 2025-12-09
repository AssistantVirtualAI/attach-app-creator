import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/context/OrganizationContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ClientProvider } from "@/context/ClientContext";

import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import AgencyHome from "./pages/AgencyHome";
import Dashboard from "./pages/Dashboard";
import VoiceAnalytics from "./pages/VoiceAnalytics";
import Conversations from "./pages/Conversations";
import ConversationDetail from "./pages/ConversationDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import Settings from "./pages/Settings";
import Clients from "./pages/Clients";
import Integrations from "./pages/Integrations";
import WebhookLogs from "./pages/WebhookLogs";
import StripeBilling from "./pages/StripeBilling";
import SaaSConfigurator from "./pages/SaaSConfigurator";
import EmailTemplates from "./pages/EmailTemplates";
import Agents from "./pages/Agents";
import AgentSettings from "./pages/AgentSettings";
import Workflows from "./pages/Workflows";
import WorkflowBuilder from "./pages/WorkflowBuilder";
import Team from "./pages/Team";
import ApiKeys from "./pages/ApiKeys";
import ClientDetail from "./pages/ClientDetail";
import ClientLogin from "./pages/ClientLogin";
import ClientPortal from "./pages/ClientPortal";
import ClientConversations from "./pages/ClientConversations";
import ClientAnalytics from "./pages/ClientAnalytics";
import WidgetPrototype from "./pages/WidgetPrototype";
import WidgetIframe from "./pages/WidgetIframe";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import BAAgreement from "./pages/BAAgreement";
import Legal from "./pages/Legal";
import Docs from "./pages/Docs";
import Topics from "./pages/Topics";
import Campaigns from "./pages/Campaigns";
import Appointments from "./pages/Appointments";
import AgentReports from "./pages/AgentReports";
import AgentBuilder from "./pages/AgentBuilder";
import Leads from "./pages/Leads";
import PhoneNumbers from "./pages/PhoneNumbers";
import Handoffs from "./pages/Handoffs";
import SmsTemplates from "./pages/SmsTemplates";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--gradient-hero)]">
        <div className="text-2xl font-bold gradient-text">Chargement...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <OrganizationProvider>
            <Suspense fallback={<div>Loading...</div>}>
              <Routes>
                <Route path="/auth" element={<AuthPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AgencyHome />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analytics"
                  element={
                    <ProtectedRoute>
                      <VoiceAnalytics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/conversations"
                  element={
                    <ProtectedRoute>
                      <Conversations />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/conversations/:id"
                  element={
                    <ProtectedRoute>
                      <ConversationDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/knowledge-base"
                  element={
                    <ProtectedRoute>
                      <KnowledgeBase />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients"
                  element={
                    <ProtectedRoute>
                      <Clients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clients/:clientId"
                  element={
                    <ProtectedRoute>
                      <ClientDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/integrations"
                  element={
                    <ProtectedRoute>
                      <Integrations />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/webhook-logs"
                  element={
                    <ProtectedRoute>
                      <WebhookLogs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/stripe-billing"
                  element={
                    <ProtectedRoute>
                      <StripeBilling />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/saas-config"
                  element={
                    <ProtectedRoute>
                      <SaaSConfigurator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/email-templates"
                  element={
                    <ProtectedRoute>
                      <EmailTemplates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agents"
                  element={
                    <ProtectedRoute>
                      <Agents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agent-settings/:agentId"
                  element={
                    <ProtectedRoute>
                      <AgentSettings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/team"
                  element={
                    <ProtectedRoute>
                      <Team />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/api-keys"
                  element={
                    <ProtectedRoute>
                      <ApiKeys />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workflows"
                  element={
                    <ProtectedRoute>
                      <Workflows />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/workflow-builder/:workflowId"
                  element={
                    <ProtectedRoute>
                      <WorkflowBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/topics"
                  element={
                    <ProtectedRoute>
                      <Topics />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/campaigns"
                  element={
                    <ProtectedRoute>
                      <Campaigns />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/appointments"
                  element={
                    <ProtectedRoute>
                      <Appointments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agent-reports"
                  element={
                    <ProtectedRoute>
                      <AgentReports />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agent-builder"
                  element={
                    <ProtectedRoute>
                      <AgentBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/agent-builder/:agentId"
                  element={
                    <ProtectedRoute>
                      <AgentBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/leads"
                  element={
                    <ProtectedRoute>
                      <Leads />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/phone-numbers"
                  element={
                    <ProtectedRoute>
                      <PhoneNumbers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/handoffs"
                  element={
                    <ProtectedRoute>
                      <Handoffs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/sms-templates"
                  element={
                    <ProtectedRoute>
                      <SmsTemplates />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings/baa"
                  element={
                    <ProtectedRoute>
                      <BAAgreement />
                    </ProtectedRoute>
                  }
                />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/docs" element={<Docs />} />
                
                {/* Client Portal Routes - Separate authentication */}
                <Route
                  path="/client/login"
                  element={
                    <ClientProvider>
                      <ClientLogin />
                    </ClientProvider>
                  }
                />
                <Route path="/client/:clientId" element={<ClientPortal />}>
                  <Route path="conversations" element={<ClientConversations />} />
                  <Route path="analytics" element={<ClientAnalytics />} />
                </Route>

                {/* Public Widget Routes - No authentication */}
                <Route path="/prototype/:agentId" element={<WidgetPrototype />} />
                <Route path="/iframe/:agentId" element={<WidgetIframe />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </OrganizationProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
