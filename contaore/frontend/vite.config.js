import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // React/Router cambiano raramente rispetto al codice app: isolarli in
        // un chunk stabile permette al browser di tenerli in cache tra un
        // deploy e l'altro invece di riscaricarli ad ogni release.
        // Attenzione: il match è sui confini esatti di package name dentro
        // node_modules, non su substring "/react/" — altrimenti pacchetti
        // come "@sentry/react" verrebbero inclusi per errore nel chunk eager.
        manualChunks(id) {
          const m = id.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)\//);
          const pkg = m && m[1];
          if (pkg === "react" || pkg === "react-dom" || pkg === "scheduler" ||
              pkg === "react-router" || pkg === "react-router-dom" ||
              (pkg && pkg.startsWith("@remix-run/"))) {
            return "vendor-react";
          }
        },
      },
    },
  },
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'stooge-subpar-smile.ngrok-free.dev',
    ],
  },
})