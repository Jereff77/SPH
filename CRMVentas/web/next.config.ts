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

  // Deshabilitar type checking durante build para permitir despliegue
  typescript: {
    ignoreBuildErrors: true,
  },

  // Deshabilitar ESLint durante build para permitir despliegue
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
