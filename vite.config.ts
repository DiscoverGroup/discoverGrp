import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApiTarget = env.VITE_DEV_API_TARGET || env.VITE_API_BASE_URL || 'http://localhost:4000';

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      host: true,
      port: 5173,
      strictPort: true,
      hmr: {
        host: 'localhost',
        protocol: 'ws',
        port: 5173,
      },
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/public': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/auth': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/admin': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/health': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/health-simple': {
          target: devApiTarget,
          changeOrigin: true,
        },
      },
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
  };
})