import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import LanguageProvider from "./context/LanguageContext";
import { initializePaymentProviders } from "./services/providers";
import "./index.css";

// Initialize payment providers on app startup
initializePaymentProviders().catch((error) => {
  console.error("Failed to initialize payment providers:", error);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <LanguageProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </LanguageProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
