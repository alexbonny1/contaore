import { useState } from "react";
import { Link } from "react-router-dom";
import posthog from "posthog-js";

export default function CookieConsentBanner() {
  const [choice, setChoice] = useState(() => localStorage.getItem("cookie_consent"));

  if (choice) return null;

  function accept() {
    posthog.opt_in_capturing();
    localStorage.setItem("cookie_consent", "accepted");
    setChoice("accepted");
  }

  function reject() {
    localStorage.setItem("cookie_consent", "rejected");
    setChoice("rejected");
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-3 sm:p-4">
      <div className="max-w-2xl mx-auto bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed flex-1">
          Usiamo strumenti di analisi (PostHog) per capire come viene usata l'app, solo
          se acconsenti. Puoi leggere i dettagli nella{" "}
          <Link to="/cookie-policy" className="underline text-zinc-800 dark:text-zinc-200" target="_blank">
            Cookie Policy
          </Link>.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={reject}
            className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            Rifiuta
          </button>
          <button
            onClick={accept}
            className="h-10 px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium hover:bg-black dark:hover:bg-white transition"
          >
            Accetta
          </button>
        </div>
      </div>
    </div>
  );
}
