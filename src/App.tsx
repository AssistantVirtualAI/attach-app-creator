import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { OrganizationProvider } from "@/context/OrganizationContext";
import { ThemeProvider } from "@/context/ThemeContext";

import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import VoiceAnalytics from "./pages/VoiceAnalytics";
import Conversations from "./pages/Conversations";
import ConversationDetail from "./pages/ConversationDetail";
import KnowledgeBase from "./pages/KnowledgeBase";
import AgentConfig from "./pages/AgentConfig";
import Settings from "./pages/Settings";
import Clients from "./pages/Clients";
import Integrations from "./pages/Integrations";
import WebhookLogs from "./pages/WebhookLogs";
import StripeBilling from "./pages/StripeBilling";
import SaaSConfigurator from "./pages/SaaSConfigurator";
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
                  <Index />
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
              path="/agent-config"
              element={
                <ProtectedRoute>
                  <AgentConfig />
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