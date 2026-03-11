import * as React from "react";
import AppRouter from "./router";
import { ThemeProvider } from "./context/ThemeContext";
import CookieConsent from "./components/CookieConsent";

export default function App() {
  return (
    <ThemeProvider>
      <AppRouter />
      <CookieConsent />
    </ThemeProvider>
  );
}