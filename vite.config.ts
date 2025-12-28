import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // Désactivé pour la prod pour alléger
    rollupOptions: {
      output: {
        // Optimisation du cache : sépare les librairies du code de l'app
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react', 'recharts', '@supabase/supabase-js'],
        },
      },
    },
  },
});