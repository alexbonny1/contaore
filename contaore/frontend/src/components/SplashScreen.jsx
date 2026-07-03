export default function SplashScreen({ exiting = false }) {
  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-zinc-100 dark:bg-[#0f0f10] transition-all duration-300 ease-out ${
        exiting ? "opacity-0 scale-110" : "opacity-100 scale-100"
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <img src="/logo.png" alt="Timbry" className="h-14 w-auto" />
        <p className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">Timbry</p>
      </div>
    </div>
  );
}
