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
import { LanguageProvider } from "@/context/LanguageContext";
import { AppErrorBoundary } from "@/components/errors/AppErrorBoundary";

import Landing from "./pages/Landing";
import AuthPage from "./pages/Auth";
import AgencyHome from "./pages/AgencyHome";
import Dashboard from "./pages/Dashboard";
import VoiceAnalytics from "./pages/VoiceAnalytics";
import Conversations from "./pages/Conversations";
import ConversationDetail from "./pages/ConversationDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
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
import ClientForgotPassword from "./pages/ClientForgotPassword";
import ClientResetPassword from "./pages/ClientResetPassword";
import ClientPortal from "./pages/ClientPortal";
import ClientAgentPortal from "./pages/ClientAgentPortal";
import ClientConversations from "./pages/ClientConversations";
import ClientAnalytics from "./pages/ClientAnalytics";
import ClientAgentDashboard from "./pages/ClientAgentDashboard";
import ClientAgentConversations from "./pages/ClientAgentConversations";
import ClientAgentAnalytics from "./pages/ClientAgentAnalytics";
import ClientAgentKnowledge from "./pages/ClientAgentKnowledge";
import ClientAgentSettings from "./pages/ClientAgentSettings";
import ClientAgentEndpoints from "./pages/ClientAgentEndpoints";
import ClientAgentMCP from "./pages/ClientAgentMCP";
import ClientAgentWebhooks from "./pages/ClientAgentWebhooks";
import ClientAgentWidget from "./pages/ClientAgentWidget";
import WidgetPrototype from "./pages/WidgetPrototype";
import WidgetIframe from "./pages/WidgetIframe";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import BAAgreement from "./pages/BAAgreement";
import Legal from "./pages/Legal";
import Support from "./pages/Support";
import Docs from "./pages/Docs";
import Topics from "./pages/Topics";
import Campaigns from "./pages/Campaigns";
import Appointments from "./pages/Appointments";
import AgentReports from "./pages/AgentReports";
import AgentBuilder from "./pages/AgentBuilder";
import AgentComparison from "./pages/AgentComparison";
import Leads from "./pages/Leads";
import PhoneNumbers from "./pages/PhoneNumbers";
import Handoffs from "./pages/Handoffs";
import SmsTemplates from "./pages/SmsTemplates";
import NotFound from "./pages/NotFound";
import DemoCenter from "./pages/DemoCenter";
import RealtimeMonitor from "./pages/RealtimeMonitor";
import ApiExplorer from "./pages/ApiExplorer";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import TwilioManagement from "./pages/TwilioManagement";
import FeaturesPage from "./pages/Features";
import DemoRequestPage from "./pages/DemoRequest";
import ContactUs from "./pages/ContactUs";
import AuditLogs from "./pages/AuditLogs";
import Download from "./pages/Download";

// Lemtel module
import { LemtelGuard } from "./pages/lemtel/LemtelGuard";
import LemtelDashboard from "./pages/lemtel/LemtelDashboard";
import PortalDiagnostic from "./pages/lemtel/PortalDiagnostic";
import LemtelPortalDashboard from "./pages/lemtel/PortalDashboard";
import LemtelSettings from "./pages/lemtel/LemtelSettings";
import LemtelMessages from "./pages/lemtel/LemtelMessages";
import LemtelPortalCalls from "./pages/lemtel/LemtelPortalCalls";
import LemtelStub from "./pages/lemtel/LemtelStub";
import LemtelCustomers from "./pages/lemtel/LemtelCustomers";
import LemtelExtensions from "./pages/lemtel/LemtelExtensions";
import LemtelDIDs from "./pages/lemtel/LemtelDIDs";
import LemtelQueues from "./pages/lemtel/LemtelQueues";
import LemtelIVR from "./pages/lemtel/LemtelIVR";
import LemtelVoiceAgents from "./pages/lemtel/LemtelVoiceAgents";
import LemtelSoftphoneUsers from "./pages/lemtel/LemtelSoftphoneUsers";
import LemtelDevices from "./pages/lemtel/LemtelDevices";
import TelephonyDashboard from "./pages/telephony/TelephonyDashboard";
import TelephonySettings from "./pages/telephony/TelephonySettings";
import TelephonyRecordings from "./pages/telephony/TelephonyRecordings";
import TelephonyRingGroups from "./pages/telephony/TelephonyRingGroups";
import TelephonyAI from "./pages/telephony/TelephonyAI";
import TelephonyWebphone from "./pages/telephony/TelephonyWebphone";
import TelephonyVoicemail from "./pages/telephony/TelephonyVoicemail";
import TelephonyTeam from "./pages/telephony/TelephonyTeam";
import TelephonyUserPreferences from "./pages/telephony/TelephonyUserPreferences";
import CallCenterAgent from "./pages/callcenter/CallCenterAgent";
import CallCenterWallboard from "./pages/callcenter/CallCenterWallboard";
import CallCenterAdmin from "./pages/callcenter/CallCenterAdmin";
import TelephonyDiagnostics from "./pages/telephony/TelephonyDiagnostics";
import TelephonyChecklist from "./pages/telephony/TelephonyChecklist";
import TelephonyPortalMappings from "./pages/telephony/TelephonyPortalMappings";
import TelephonyUsers from "./pages/telephony/TelephonyUsers";
import { TelephonyLayout } from "./components/telephony/TelephonyLayout";
import { PortalGuard } from "./components/telephony/PortalGuard";
import LemtelAnalytics from "./pages/lemtel/LemtelAnalytics";
import { AdminPortalLayout, UserPortalLayout } from "./components/portal/LemtelPortalShells";
import AdminDashboard from "./pages/lemtel/admin/AdminDashboard";
import MyDashboard from "./pages/lemtel/my/MyDashboard";
import AdminRecordings from "./pages/lemtel/admin/AdminRecordings";
import AdminVoicemail from "./pages/lemtel/admin/AdminVoicemail";
import AdminReports from "./pages/lemtel/admin/AdminReports";
import MySettings from "./pages/lemtel/my/MySettings";
import { DownloadCenter } from "./components/portal/DownloadCenter";

// Portal pages
import PortalLogin from "./pages/PortalLogin";
import PortalLayout from "./components/portal/PortalLayout";
import PortalDashboard from "./pages/PortalDashboard";
import PortalConversations from "./pages/PortalConversations";
import PortalAnalytics from "./pages/PortalAnalytics";
import PortalKnowledge from "./pages/PortalKnowledge";
import PortalPrompt from "./pages/PortalPrompt";
import PortalSettings from "./pages/PortalSettings";
import PortalProfile from "./pages/PortalProfile";
import UniversalLogin from "./pages/UniversalLogin";

const queryClient = new QueryClient();

import { TrialExpiredGate } from "./components/billing/TrialExpiredGate";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--gradient-hero)]">
        <div className="text-2xl font-bold gradient-text">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <TrialExpiredGate>{children}</TrialExpiredGate>;
};

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
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
                {/* Landing page on root */}
                <Route path="/" element={<Landing />} />

                {/* Public full feature list */}
                <Route path="/features" element={<FeaturesPage />} />

                {/* Public demo request */}
                <Route path="/demo-request" element={<DemoRequestPage />} />
                
                {/* Contact Us */}
                <Route path="/contact" element={<ContactUs />} />

                {/* Public download page */}
                <Route path="/download" element={<Download />} />
                
                {/* Universal login - redirects based on user type */}
                <Route path="/login" element={<UniversalLogin />} />
                
                {/* Admin auth (legacy, redirects to /login) */}
                <Route path="/auth" element={<Navigate to="/login" replace />} />
                
                {/* Protected routes */}
                <Route
                  path="/home"
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
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
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
                  path="/twilio-management"
                  element={
                    <ProtectedRoute>
                      <TwilioManagement />
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
                  path="/agent-comparison"
                  element={
                    <ProtectedRoute>
                      <AgentComparison />
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
                <Route path="/support" element={<Support />} />
                <Route path="/legal" element={<Legal />} />
                <Route path="/docs" element={<Docs />} />
                <Route
                  path="/demo"
                  element={
                    <ProtectedRoute>
                      <DemoCenter />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/realtime"
                  element={
                    <ProtectedRoute>
                      <RealtimeMonitor />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/api-explorer"
                  element={
                    <ProtectedRoute>
                      <ApiExplorer />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super-admin"
                  element={
                    <ProtectedRoute>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/audit-logs"
                  element={
                    <ProtectedRoute>
                      <AuditLogs />
                    </ProtectedRoute>
                  }
                />
                
                {/* Lemtel Telecom Module — gated to Lemtel org members */}
                <Route path="/lemtel/dashboard" element={<ProtectedRoute><LemtelGuard><LemtelDashboard /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/settings" element={<ProtectedRoute><LemtelGuard><LemtelSettings /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/messages" element={<ProtectedRoute><LemtelGuard><LemtelMessages /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/customers" element={<ProtectedRoute><LemtelGuard><LemtelCustomers /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/dids" element={<ProtectedRoute><LemtelGuard><LemtelDIDs /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/extensions" element={<ProtectedRoute><LemtelGuard><LemtelExtensions /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/devices" element={<ProtectedRoute><LemtelGuard><LemtelDevices /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/queues" element={<ProtectedRoute><LemtelGuard><LemtelQueues /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/ivr" element={<ProtectedRoute><LemtelGuard><LemtelIVR /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/voice-agents" element={<ProtectedRoute><LemtelGuard><LemtelVoiceAgents /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/softphone-users" element={<ProtectedRoute><LemtelGuard><LemtelSoftphoneUsers /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/analytics" element={<ProtectedRoute><LemtelGuard><LemtelAnalytics /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/calls" element={<ProtectedRoute><LemtelGuard><LemtelPortalCalls /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/dashboard" element={<ProtectedRoute><LemtelGuard><LemtelDashboard /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/extensions" element={<ProtectedRoute><LemtelGuard><LemtelExtensions /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/recordings" element={<ProtectedRoute><LemtelGuard><LemtelStub title="Recordings" description="Call recordings will appear here once FusionPBX is connected." /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/queues" element={<ProtectedRoute><LemtelGuard><LemtelQueues /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/ivr" element={<ProtectedRoute><LemtelGuard><LemtelIVR /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/messages" element={<ProtectedRoute><LemtelGuard><LemtelMessages /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/agents" element={<ProtectedRoute><LemtelGuard><LemtelVoiceAgents /></LemtelGuard></ProtectedRoute>} />
                <Route path="/lemtel/portal/softphone" element={<ProtectedRoute><LemtelGuard><LemtelStub title="Softphone" description="Use the floating softphone widget at the bottom-right." /></LemtelGuard></ProtectedRoute>} />

                {/* New /org/lemtel/telephony/* admin routes */}
                <Route path="/org/lemtel/telephony/dashboard" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyDashboard /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/numbers" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><LemtelDIDs /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/extensions" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><LemtelExtensions /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/users" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyUsers /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/devices" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><LemtelDevices /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/calls" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><LemtelPortalCalls /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/recordings" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyRecordings /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/ivr" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><LemtelIVR /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/queues" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><LemtelQueues /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/ring-groups" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyRingGroups /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/messages" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><LemtelMessages /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/agents" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><LemtelVoiceAgents /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/ai" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyAI /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/webphone" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyWebphone /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/settings" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonySettings /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/voicemail" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyVoicemail /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/team" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyTeam /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/preferences" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyUserPreferences /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/callcenter/agent" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><CallCenterAgent /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/callcenter/wallboard" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><CallCenterWallboard /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/callcenter/admin" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><CallCenterAdmin /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/diagnostics" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyDiagnostics /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/checklist" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyChecklist /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/telephony/portal-mappings" element={<ProtectedRoute><LemtelGuard><TelephonyLayout><TelephonyPortalMappings /></TelephonyLayout></LemtelGuard></ProtectedRoute>} />

                {/* v3.0 Admin Portal (/org/lemtel/admin/*) */}
                <Route path="/org/lemtel/admin" element={<Navigate to="/org/lemtel/admin/dashboard" replace />} />
                <Route path="/org/lemtel/admin/dashboard" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><AdminDashboard /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/extensions" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><LemtelExtensions /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/dids" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><LemtelDIDs /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/devices" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><LemtelDevices /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/ivr" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><LemtelIVR /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/queues" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><LemtelQueues /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/ring-groups" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><TelephonyRingGroups /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/recordings" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><AdminRecordings /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/voicemail" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><AdminVoicemail /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/reports" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><AdminReports /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/settings" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><TelephonySettings /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/admin/downloads" element={<ProtectedRoute><LemtelGuard><AdminPortalLayout><DownloadCenter /></AdminPortalLayout></LemtelGuard></ProtectedRoute>} />

                {/* v3.0 User Portal (/org/lemtel/my/*) */}
                <Route path="/org/lemtel/my" element={<Navigate to="/org/lemtel/my/dashboard" replace />} />
                <Route path="/org/lemtel/my/dashboard" element={<ProtectedRoute><LemtelGuard><UserPortalLayout><MyDashboard /></UserPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/my/calls" element={<ProtectedRoute><LemtelGuard><UserPortalLayout><LemtelPortalCalls /></UserPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/my/recordings" element={<ProtectedRoute><LemtelGuard><UserPortalLayout><AdminRecordings scope="mine" /></UserPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/my/voicemail" element={<ProtectedRoute><LemtelGuard><UserPortalLayout><AdminVoicemail scope="mine" /></UserPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/my/sms" element={<ProtectedRoute><LemtelGuard><UserPortalLayout><LemtelMessages /></UserPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/my/settings" element={<ProtectedRoute><LemtelGuard><UserPortalLayout><MySettings /></UserPortalLayout></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/my/downloads" element={<ProtectedRoute><LemtelGuard><UserPortalLayout><DownloadCenter personalize /></UserPortalLayout></LemtelGuard></ProtectedRoute>} />

                {/* /org/lemtel/portal/* customer routes (PortalGuard enforces customer scope) */}
                <Route path="/org/lemtel/portal" element={<Navigate to="/org/lemtel/portal/dashboard" replace />} />
                <Route path="/org/lemtel/portal/diagnostic" element={<ProtectedRoute><PortalDiagnostic /></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/dashboard" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><LemtelPortalDashboard /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/extensions" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><LemtelExtensions /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/calls" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><LemtelPortalCalls /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/recordings" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><TelephonyRecordings /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/ivr" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><LemtelIVR /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/queues" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><LemtelQueues /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/messages" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><LemtelMessages /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/agents" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><LemtelVoiceAgents /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />
                <Route path="/org/lemtel/portal/softphone" element={<ProtectedRoute><LemtelGuard><PortalGuard><TelephonyLayout portal><TelephonyWebphone /></TelephonyLayout></PortalGuard></LemtelGuard></ProtectedRoute>} />

                
                <Route
                  path="/client/login"
                  element={
                    <ClientProvider>
                      <ClientLogin />
                    </ClientProvider>
                  }
                />
                <Route
                  path="/client/forgot-password"
                  element={
                    <ClientProvider>
                      <ClientForgotPassword />
                    </ClientProvider>
                  }
                />
                <Route
                  path="/client/reset-password/:token"
                  element={
                    <ClientProvider>
                      <ClientResetPassword />
                    </ClientProvider>
                  }
                />
                <Route path="/client/:clientId" element={<ClientPortal />}>
                  <Route path="conversations" element={<ClientConversations />} />
                  <Route path="analytics" element={<ClientAnalytics />} />
                </Route>

                {/* Client Agent Portal Routes - Per agent access */}
                <Route path="/client/:clientId/agent/:agentId" element={<ClientAgentPortal />}>
                  <Route path="dashboard" element={<ClientAgentDashboard />} />
                  <Route path="conversations" element={<ClientAgentConversations />} />
                  <Route path="analytics" element={<ClientAgentAnalytics />} />
                  <Route path="knowledge" element={<ClientAgentKnowledge />} />
                  <Route path="settings" element={<ClientAgentSettings />} />
                  <Route path="endpoints" element={<ClientAgentEndpoints />} />
                  <Route path="mcp" element={<ClientAgentMCP />} />
                  <Route path="webhooks" element={<ClientAgentWebhooks />} />
                  <Route path="widget" element={<ClientAgentWidget />} />
                </Route>

                {/* New Portal Routes - Agent slug based directly at root */}
                <Route path="/:agentSlug">
                  <Route index element={<PortalLogin />} />
                  <Route element={<PortalLayout />}>
                    <Route path="dashboard" element={<PortalDashboard />} />
                    <Route path="conversations" element={<PortalConversations />} />
                    <Route path="analytics" element={<PortalAnalytics />} />
                    <Route path="knowledge" element={<PortalKnowledge />} />
                    <Route path="prompt" element={<PortalPrompt />} />
                    <Route path="settings" element={<PortalSettings />} />
                    <Route path="profile" element={<PortalProfile />} />
                  </Route>
                </Route>

                {/* Keep legacy portal routes for backward compatibility */}
                <Route path="/portal/:agentSlug">
                  <Route index element={<PortalLogin />} />
                  <Route element={<PortalLayout />}>
                    <Route path="dashboard" element={<PortalDashboard />} />
                    <Route path="conversations" element={<PortalConversations />} />
                    <Route path="analytics" element={<PortalAnalytics />} />
                    <Route path="knowledge" element={<PortalKnowledge />} />
                    <Route path="prompt" element={<PortalPrompt />} />
                    <Route path="settings" element={<PortalSettings />} />
                    <Route path="profile" element={<PortalProfile />} />
                  </Route>
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
    </LanguageProvider>
  </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
