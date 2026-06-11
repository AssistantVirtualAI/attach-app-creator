import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./lib/devPreviewGuard";
import "./lib/styleHealthGuard";
import "./lib/buildVersionPoller";
import App from "./App.tsx";
import { initSentry } from "./lib/sentry";

// Initialize Sentry for error monitoring (if configured)
initSentry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
