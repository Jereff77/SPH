import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Lee `APP_VERSION_RAW` de src/lib/constants.ts (única fuente de la versión). */
function leerVersion(): string {
  const ruta = fileURLToPath(new URL('./src/lib/constants.ts', import.meta.url));
  const src = readFileSync(ruta, 'utf8');
  return /APP_VERSION_RAW\s*=\s*'([^']+)'/.exec(src)?.[1] ?? '0.0.0';
}

/**
 * Emite `version.json` con la versión de ESTE build (y lo sirve también en dev).
 * El frontend lo consulta para avisar cuando hay una versión más nueva que el
 * bundle cargado — SIN depender de la base de datos: refleja el despliegue real.
 */
function versionJson(): Plugin {
  return {
    name: 'emitir-version-json',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: leerVersion() }),
      });
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ version: leerVersion() }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionJson()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
