import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, Radio, Settings } from "lucide-react";
import { hasPermission } from "../api";
import { prefetchRequests, prefetchReaders, prefetchSettings } from "../prefetch";

/**
 * Barra di navigazione inferiore con indicatore "a goccia" elastico:
 * l'indicatore attivo cola tra le voci con un effetto gooey + molla.
 * Vetro leggero (poca trasparenza), affidabile anche su iPhone.
 */
export default function BottomNav({ portaleAttivo = true, pendingCount = 0 }) {
  const location = useLocation();
  const path = location.pathname;

  const navItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard", match: p => p === "/dashboard" },
    hasPermission("can_approve_requests") && { title: portaleAttivo ? "Permessi" : "Ferie", icon: FileText, path: "/requests", notifica: pendingCount,
      match: p => p.startsWith("/requests") || p.startsWith("/pause"), prefetch: prefetchRequests },
    { title: "Lettori",   icon: Radio,    path: "/readers", match: p => p.startsWith("/readers"), prefetch: prefetchReaders },
    { title: "Account",   icon: Settings, path: "/impostazioni", match: p => p.startsWith("/impostazioni"), prefetch: prefetchSettings },
  ].filter(Boolean);

  const activeIndex = navItems.findIndex(it => it.match(path));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pointer-events-none pb-safe-bottom">
      {/* filtro gooey per l'effetto goccia liquida (supportato anche da iOS Safari) */}
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix in="blur" mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      <div className="mx-auto max-w-md px-4 pb-3 sm:pb-4">
        <div className="pointer-events-auto relative rounded-[28px] border border-black/5 dark:border-white/10 bg-white/85 dark:bg-[#1c1c1e]/90 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.5)] px-2 py-2">
          {/* riflesso speculare leggero */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-t-[28px] bg-gradient-to-b from-white/50 to-transparent dark:from-white/5" />

          {/* GOCCIA elastica (indicatore attivo) */}
          <div className="pointer-events-none absolute inset-y-2 left-2 right-2" style={{ filter: "url(#goo)" }}>
            <div
              className="absolute top-0 h-full rounded-3xl bg-zinc-900 dark:bg-zinc-100"
              style={{
                width: `${100 / navItems.length}%`,
                transform: `translateX(${activeIndex < 0 ? 0 : activeIndex * 100}%)`,
                opacity: activeIndex < 0 ? 0 : 1,
                transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease",
              }}
            />
          </div>

          {/* VOCI */}
          <div className="relative z-10 flex">
            {navItems.map((item, i) => {
              const Icon = item.icon;
              const isActive = i === activeIndex;
              return (
                <Link
                  key={item.title}
                  to={item.path}
                  onMouseEnter={item.prefetch}
                  onTouchStart={item.prefetch}
                  onFocus={item.prefetch}
                  className={`relative flex flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2 text-[10px] font-medium transition-colors duration-300 ${
                    isActive
                      ? "text-white dark:text-black"
                      : "text-zinc-500 dark:text-zinc-400"
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
      </div>
    </nav>
  );
}
