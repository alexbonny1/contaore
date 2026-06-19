import { Clock, Umbrella, Send, User } from "lucide-react";

/**
 * Barra di navigazione inferiore del portale dipendente (stile Apple liquid glass,
 * goccia elastica). Basata su tab locali (non rotte).
 */
export default function DipendenteBottomNav({ active, onSelect }) {
  const items = [
    { id: "presenze",  title: "Presenze",  icon: Clock },
    { id: "ferie",     title: "Ferie",     icon: Umbrella },
    { id: "richieste", title: "Richieste", icon: Send },
    { id: "profilo",   title: "Profilo",   icon: User },
  ];
  const activeIndex = items.findIndex(i => i.id === active);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 pointer-events-none pb-safe-bottom">
      <svg aria-hidden="true" width="0" height="0" className="absolute">
        <filter id="goo-dip">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix in="blur" mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      <div className="mx-auto max-w-md px-4 pb-3 sm:pb-4">
        <div className="pointer-events-auto relative rounded-[28px] border border-black/5 dark:border-white/10 bg-white/85 dark:bg-[#1c1c1e]/90 backdrop-blur-md shadow-[0_6px_24px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.5)] px-2 py-2">
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-0 h-1/2 rounded-t-[28px] bg-gradient-to-b from-white/50 to-transparent dark:from-white/5" />

          <div className="pointer-events-none absolute inset-y-2 left-2 right-2" style={{ filter: "url(#goo-dip)" }}>
            <div
              className="absolute top-0 h-full rounded-3xl bg-zinc-900 dark:bg-zinc-100"
              style={{
                width: "25%",
                transform: `translateX(${activeIndex < 0 ? 0 : activeIndex * 100}%)`,
                opacity: activeIndex < 0 ? 0 : 1,
                transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease",
              }}
            />
          </div>

          <div className="relative z-10 flex">
            {items.map((item, i) => {
              const Icon = item.icon;
              const isActive = i === activeIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={`relative flex flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2 text-[10px] font-medium transition-colors duration-300 ${
                    isActive ? "text-white dark:text-black" : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  <Icon size={22} strokeWidth={2} />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
