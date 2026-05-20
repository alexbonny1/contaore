import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'stooge-subpar-smile.ngrok-free.dev',
    ],
  },
})