import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configuración crítica para Docker
  output: 'standalone', // Genera build optimizado para contenedores

  // Optimizaciones
  reactStrictMode: true,

  // Configuración de imágenes para Docker
  images: {
    unoptimized: true, // Evita problemas con CDN en entorno Docker
  },
};

export default nextConfig;
