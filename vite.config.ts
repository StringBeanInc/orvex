import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { include: ['firebase/functions'] },
  server: {
    // Test PDFs/HTML/traces must not reload an open business editor.
    watch: { ignored: ['**/tmp/**', '**/test-results/**', '**/playwright-report/**', '**/emulator-backups/**', '**/firebase-export-*/**'] },
    allowedHosts: ['.trycloudflare.com'],
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
