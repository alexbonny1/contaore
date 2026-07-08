import { useState } from "react";
import { Bell } from "lucide-react";
import { API_URL } from "../api";
import { requestPushPermission, subscribeToPush } from "../push";

/*
 * Card di stato/gestione notifiche push, riusata in Impostazioni → Notifiche
 * (titolare/admin) e nel portale dipendente.
 * onToast(message, isError) — il chiamante decide come mostrare il toast,
 * dato che le pagine usano convenzioni diverse per il tipo.
 */
export default function PushStatusCard({ onToast }) {
  const [pushPermission, setPushPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  function notify(message, isError = false) {
    onToast?.(message, isError);
  }

  async function handleEnable() {
    const { permission, subscribed, error } = await requestPushPermission();
    setPushPermission(permission);
    if (permission === "granted" && subscribed) {
      notify("Notifiche push abilitate");
    } else if (permission === "granted" && !subscribed) {
      notify(`Permesso concesso ma registrazione fallita: ${error || "errore sconosciuto"}`, true);
    }
  }

  async function handleTest() {
    const token = localStorage.getItem("token");
    try {
      let res  = await fetch(`${API_URL}/api/push/test`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      let data = await res.json();

      // Se il permesso c'è ma la subscription non è mai stata salvata sul
      // server (es. un tentativo precedente fallito), riprova a registrarla
      // prima di arrenderti: evita di restare bloccati senza modo di ritentare.
      if (!data.success && data.error === "NO_SUBSCRIPTIONS") {
        const sub = await subscribeToPush();
        if (!sub.ok) {
          notify(`Registrazione dispositivo fallita: ${sub.error || "errore sconosciuto"}`, true);
          return;
        }
        res  = await fetch(`${API_URL}/api/push/test`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
        data = await res.json();
      }

      if (data.success) notify(`Notifica di prova inviata (${data.subscriptions} dispositivo/i)`);
      else notify(data.message || data.error || "Errore invio notifica di prova", true);
    } catch (e) {
      notify("Errore di rete durante il test", true);
    }
  }

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-4 sm:p-5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
        <Bell size={17} className="text-indigo-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Notifiche push</p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {pushPermission === "granted" ? "Abilitate su questo dispositivo"
            : pushPermission === "denied" ? "Bloccate dal browser — riabilitale dalle impostazioni del sito"
            : pushPermission === "unsupported" ? "Non supportate su questo browser/dispositivo"
            : "Non ancora abilitate su questo dispositivo"}
        </p>
      </div>
      {pushPermission === "default" && (
        <button onClick={handleEnable} className="shrink-0 h-9 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-medium">
          Abilita
        </button>
      )}
      {pushPermission === "granted" && (
        <button onClick={handleTest} className="shrink-0 h-9 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium">
          Invia prova
        </button>
      )}
    </div>
  );
}
