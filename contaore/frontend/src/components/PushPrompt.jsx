import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { isPushSupported, isIosSafariNotStandalone, requestPushPermission, subscribeToPush } from "../push";

const DISMISS_KEY = "push_prompt_dismissed";

export default function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [iosInstallHint, setIosInstallHint] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;

    // Il permesso del browser è già "granted" ma la subscription sul server
    // potrebbe non essersi mai salvata (rete, tabella non ancora creata al
    // momento del primo tentativo, ecc.): senza questo, l'utente resta
    // bloccato per sempre senza un modo per far ripartire la registrazione,
    // perché il prompt/bottone "Abilita" appare solo quando il permesso è
    // ancora "default". Riprova quindi in background ad ogni avvio.
    if (Notification.permission === "granted") {
      subscribeToPush().catch(() => {});
      return;
    }

    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (Notification.permission !== "default") return;

    setIosInstallHint(isIosSafariNotStandalone());
    setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  async function enable() {
    await requestPushPermission();
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-50 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] shadow-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
          <Bell size={17} className="text-indigo-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Attiva le notifiche push</p>
          {iosInstallHint ? (
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Su iPhone/iPad le notifiche funzionano solo se installi Timbry come app: apri il menu di
              condivisione <span className="font-medium">□↑</span> e scegli
              <span className="font-medium"> "Aggiungi a schermata Home"</span>, poi riapri l'app da lì.
            </p>
          ) : (
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
              Ricevi subito ferie, permessi, ritardi e avvisi importanti senza controllare l'app.
            </p>
          )}
        </div>
        <button onClick={dismiss} className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0">
          <X size={16} />
        </button>
      </div>

      {!iosInstallHint && isPushSupported() && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={enable}
            className="flex-1 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium"
          >
            Abilita
          </button>
          <button
            onClick={dismiss}
            className="h-10 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm font-medium"
          >
            Non ora
          </button>
        </div>
      )}
    </div>
  );
}
