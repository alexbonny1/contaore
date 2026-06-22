export default function OwnerHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-[#111113]/70 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Timbry" className="h-7 sm:h-8 w-auto" />
          <span className="text-lg sm:text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Timbry</span>
        </div>
      </div>
    </header>
  );
}
