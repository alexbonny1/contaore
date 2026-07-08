import { useEffect, useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { apiFetch } from "../api";
import OwnerHeader from "./OwnerHeader";
import BottomNav from "./BottomNav";
import PushPrompt from "./PushPrompt";

/**
 * Layout persistente area titolare: header + barra in basso montati UNA sola volta.
 * Le pagine sono renderizzate dentro <Outlet/> e ricevono via context i dati
 * condivisi (stato portale, conteggio/payload richieste) così non vengono rifatte
 * le fetch ad ogni cambio pagina → niente scatti/flicker.
 */
export default function OwnerLayout() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [portaleAttivo, setPortaleAttivo] = useState(user.portale_dipendenti !== false);
  const [requestsData, setRequestsData]   = useState(null);

  const refreshRequests = useCallback(() => {
    return apiFetch('/api/requests/dashboard')
      .then(d => { if (d.success) setRequestsData(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch('/api/company/info')
      .then(d => {
        if (d.success) {
          setPortaleAttivo(!!d.portale_dipendenti);
          const u = JSON.parse(localStorage.getItem("user") || "{}");
          u.portale_dipendenti = !!d.portale_dipendenti;
          localStorage.setItem("user", JSON.stringify(u));
        }
      })
      .catch(() => {});

    refreshRequests();
    const i = setInterval(refreshRequests, 30000);
    return () => clearInterval(i);
  }, [refreshRequests]);

  const pendingCount = requestsData?.counts?.totali_in_attesa ?? 0;

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      <OwnerHeader />

      <main className="pb-28">
        <Outlet context={{ portaleAttivo, pendingCount, requestsData, refreshRequests }} />
      </main>

      <BottomNav portaleAttivo={portaleAttivo} pendingCount={pendingCount} />
      <PushPrompt />
    </div>
  );
}
