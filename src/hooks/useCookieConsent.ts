import { useState, useEffect } from "react";

export type CookiePreferences = {
  necessary: true;       // always on
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
};

export type ConsentStatus = "undecided" | "accepted" | "rejected" | "custom";

const STORAGE_KEY = "dg_cookie_consent";

export function useCookieConsent() {
  const [status, setStatus] = useState<ConsentStatus>("undecided");
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { status: ConsentStatus; preferences: CookiePreferences };
        setStatus(parsed.status);
        setPreferences(parsed.preferences);
      }
    } catch {
      // ignore malformed storage
    }
  }, []);

  const save = (newStatus: ConsentStatus, newPrefs: CookiePreferences) => {
    const payload = { status: newStatus, preferences: newPrefs, savedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    setStatus(newStatus);
    setPreferences(newPrefs);
  };

  const acceptAll = () =>
    save("accepted", { necessary: true, analytics: true, marketing: true, preferences: true });

  const rejectAll = () =>
    save("rejected", { necessary: true, analytics: false, marketing: false, preferences: false });

  const saveCustom = (prefs: Omit<CookiePreferences, "necessary">) =>
    save("custom", { necessary: true, ...prefs });

  const resetConsent = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStatus("undecided");
    setPreferences({ necessary: true, analytics: false, marketing: false, preferences: false });
  };

  return { status, preferences, acceptAll, rejectAll, saveCustom, resetConsent };
}
