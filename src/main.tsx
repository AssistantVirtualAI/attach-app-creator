import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./lib/reloadDiagnostics";
import "./lib/devPreviewGuard";
import "./lib/styleHealthGuard";
import "./lib/buildVersionPoller";
import App from "./App.tsx";
import { initSentry } from "./lib/sentry";
import { consumeAppLoginToken } from "./lib/auth/consumeAppLoginToken";

// Initialize Sentry for error monitoring (if configured)
initSentry();

// Auto-login via ?ava_token=... (mobile/desktop app invites). Best-effort; runs
// before React mounts so the session is ready when ProtectedRoute evaluates.
consumeAppLoginToken().finally(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
