import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, Radio, Settings } from "lucide-react";
import { API_URL } from "../api";

/**
 * Barra di navigazione inferiore in stile Apple "liquid glass".
 * Mostra sempre le stesse 4 voci su tutte le pagine del titolare.
 * Self-contained: legge da solo conteggio richieste e stato portale,
 * senza modificare la logica delle singole pagine.
 */
export default function BottomNav() {
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const [portaleAttivo, setPortaleAttivo] = useState(user.portale_dipendenti !== false);

  useEffect(() => {
    const token = localStorage.getItem("token");

    fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setPendingCount(d.counts?.totali_in_attesa ?? 0); })
      .catch(() => {});

    fetch(`${API_URL}/api/company/info`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setPortaleAttivo(!!d.portale_dipendenti); })
      .catch(() => {});

    const i = setInterval(() => {
      fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { if (d.success) setPendingCount(d.counts?.totali_in_attesa ?? 0); })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(i);
  }, []);

  const navItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: portaleAttivo ? "Permessi" : "Ferie", icon: FileText, path: "/requests", notifica: pendingCount },
    { title: "Lettori",   icon: Radio,           path: "/readers" },
    { title: "Account",   icon: Settings,        path: "/impostazioni" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pointer-events-none pb-safe-bottom">
      <div className="mx-auto max-w-md px-4 pb-3 sm:pb-4">
        <div className="pointer-events-auto flex items-center justify-around gap-1 rounded-[28px] border border-white/50 dark:border-white/10 ring-1 ring-inset ring-white/40 dark:ring-white/5 bg-gradient-to-b from-white/70 to-white/40 dark:from-white/10 dark:to-white/[0.04] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.title}
                to={item.path}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2 text-[10px] font-medium transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-white/50 dark:hover:bg-white/5"
                }`}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={2} />
                  {item.notifica > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {item.notifica > 9 ? "9+" : item.notifica}
                    </span>
                  )}
                </span>
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
