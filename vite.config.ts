import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
   server: {
    host: true, // listen on all addresses (needed in container/WSL)
    port: 5173,
    strictPort: false,
    hmr: {
      // when you access the dev server by a different hostname (or Docker), set host here
      host: "localhost",
      protocol: "ws", // or "wss" if you're using https
      port: 5173
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['framer-motion', 'lucide-react', 'swiper'],
        },
      },
    },
  },
})