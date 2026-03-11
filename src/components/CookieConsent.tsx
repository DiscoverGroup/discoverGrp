import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, Shield, BarChart2, Megaphone, Settings2, X, ChevronDown, ChevronUp } from "lucide-react";
import { useCookieConsent, type CookiePreferences } from "../hooks/useCookieConsent";

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = {
  key: keyof Omit<CookiePreferences, "necessary">;
  icon: React.ReactNode;
  label: string;
  description: string;
};

const CATEGORIES: Category[] = [
  {
    key: "analytics",
    icon: <BarChart2 className="w-4 h-4" />,
    label: "Analytics",
    description:
      "Help us understand how visitors interact with our site so we can improve your experience. Data is aggregated and anonymous.",
  },
  {
    key: "marketing",
    icon: <Megaphone className="w-4 h-4" />,
    label: "Marketing",
    description:
      "Used to show relevant ads and sponsored content from our travel partners. Enables us to keep this website running.",
  },
  {
    key: "preferences",
    icon: <Settings2 className="w-4 h-4" />,
    label: "Preferences",
    description:
      "Remembers your settings such as language, currency, and search filters so you don't have to re-enter them.",
  },
];

// ─── Toggle Switch ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 focus-visible:ring-offset-2 ${
        checked ? "bg-yellow-400" : "bg-gray-300"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ─── Preferences Modal ─────────────────────────────────────────────────────

function PreferencesModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Omit<CookiePreferences, "necessary">;
  onSave: (prefs: Omit<CookiePreferences, "necessary">) => void;
  onClose: () => void;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (key: keyof typeof prefs) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Cookie className="w-5 h-5 text-yellow-500" />
            <span className="font-bold text-gray-900 text-lg">Cookie Preferences</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto space-y-3">
          {/* Necessary — always on */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              <div>
                <p className="font-medium text-sm text-gray-900">Necessary</p>
                <p className="text-xs text-gray-500">Required for the site to function.</p>
              </div>
            </div>
            <Toggle checked disabled />
          </div>

          {/* Configurable categories */}
          {CATEGORIES.map((cat) => {
            const isOpen = expanded === cat.key;
            return (
              <div key={cat.key} className="border border-gray-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : cat.key)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                  >
                    <span className="text-gray-500">{cat.icon}</span>
                    <span className="font-medium text-sm text-gray-900">{cat.label}</span>
                    <span className="ml-1 text-gray-400">
                      {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </span>
                  </button>
                  <Toggle
                    checked={prefs[cat.key]}
                    onChange={() => toggle(cat.key)}
                  />
                </div>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <p className="px-3 pb-3 text-xs text-gray-500 leading-relaxed">
                        {cat.description}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => onSave(prefs)}
            className="flex-1 py-2.5 px-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-xl transition-colors text-sm"
          >
            Save Preferences
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors text-sm"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Banner ───────────────────────────────────────────────────────────

export default function CookieConsent() {
  const { status, preferences, acceptAll, rejectAll, saveCustom } = useCookieConsent();
  const [showModal, setShowModal] = useState(false);

  const isVisible = status === "undecided";

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "110%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-[9998] p-4"
            role="dialog"
            aria-label="Cookie consent"
            aria-live="polite"
          >
            <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 py-4">
                {/* Icon + Text */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="mt-0.5 shrink-0 bg-yellow-100 p-2 rounded-xl">
                    <Cookie className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">
                      We use cookies
                    </p>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                      We use cookies to personalise content, show relevant ads from travel partners,
                      and analyse our traffic. This helps us keep the site running.{" "}
                      <a
                        href="/privacy"
                        className="text-blue-600 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Privacy Policy
                      </a>
                    </p>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => setShowModal(true)}
                    className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors px-1"
                  >
                    Manage
                  </button>
                  <button
                    onClick={rejectAll}
                    className="text-xs px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-700 font-medium transition-colors"
                  >
                    Reject non-essential
                  </button>
                  <button
                    onClick={acceptAll}
                    className="text-xs px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-xl transition-colors"
                  >
                    Accept all
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preferences modal */}
      <AnimatePresence>
        {showModal && (
          <PreferencesModal
            initial={{
              analytics: preferences.analytics,
              marketing: preferences.marketing,
              preferences: preferences.preferences,
            }}
            onSave={(prefs) => {
              saveCustom(prefs);
              setShowModal(false);
            }}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
