import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devApiTarget = env.VITE_ADMIN_DEV_API_TARGET || env.VITE_ADMIN_API_URL || env.VITE_API_URL || 'http://localhost:4000';

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/admin': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/auth': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/public': {
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
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': ['lucide-react'],
          },
        },
      },
    },
  };
})