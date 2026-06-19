import { useEffect, useState, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { API_URL } from "../api";
import OwnerHeader from "./OwnerHeader";
import BottomNav from "./BottomNav";

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

  /* THEME: applica il tema salvato una volta sola */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") document.documentElement.classList.add("dark");
  }, []);

  const refreshRequests = useCallback(() => {
    const token = localStorage.getItem("token");
    return fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setRequestsData(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch(`${API_URL}/api/company/info`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPortaleAttivo(!!d.portale_dipendenti);
          // persiste lo stato così il primo paint successivo è corretto (no flip)
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

      {/* Filtro SVG per l'effetto liquid glass "a goccia" (refrazione).
          Dove non supportato in backdrop-filter (iOS Safari) decade sul vetro base. */}
      <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
        <filter id="liquid-glass" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.2" result="softNoise" />
          <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="14" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      <OwnerHeader />

      <main className="pb-28">
        <Outlet context={{ portaleAttivo, pendingCount, requestsData, refreshRequests }} />
      </main>

      <BottomNav portaleAttivo={portaleAttivo} pendingCount={pendingCount} />
    </div>
  );
}
