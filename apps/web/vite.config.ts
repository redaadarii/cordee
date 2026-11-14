import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const API = process.env.VITE_API_PROXY ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { tsconfigPaths: true },
  server: {
    // Le front et l'API partagent la même origine en dev comme en prod :
    // le cookie de rafraîchissement reste en SameSite=Lax, sans CORS à gérer.
    proxy: {
      '/api': API,
      '/socket.io': { target: API, ws: true },
    },
  },
});
