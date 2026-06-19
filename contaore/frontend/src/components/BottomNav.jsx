import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, Radio, Settings } from "lucide-react";

/**
 * Barra di navigazione inferiore in stile Apple "liquid glass".
 * Presentazionale: riceve portaleAttivo e pendingCount dal layout persistente.
 */
export default function BottomNav({ portaleAttivo = true, pendingCount = 0 }) {
  const location = useLocation();

  const navItems = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { title: portaleAttivo ? "Permessi" : "Ferie", icon: FileText, path: "/requests", notifica: pendingCount },
    { title: "Lettori",   icon: Radio,           path: "/readers" },
    { title: "Account",   icon: Settings,        path: "/impostazioni" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pointer-events-none pb-safe-bottom">
      <div className="mx-auto max-w-md px-4 pb-3 sm:pb-4">
        <div className="liquid-glass pointer-events-auto relative flex items-center justify-around gap-1 overflow-hidden rounded-[28px] border border-white/50 dark:border-white/10 ring-1 ring-inset ring-white/40 dark:ring-white/5 bg-gradient-to-b from-white/70 to-white/40 dark:from-white/12 dark:to-white/[0.04] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.5)] px-2 py-2">
          {/* riflesso speculare sul bordo superiore */}
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[28px] bg-gradient-to-b from-white/40 to-transparent dark:from-white/10" />
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.title}
                to={item.path}
                className={`relative z-10 flex flex-1 flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2 text-[10px] font-medium transition-all ${
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
