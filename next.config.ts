import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Imagens do blog servidas pelo CDN da Sanity (mainImage).
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
  experimental: {
    serverActions: {
      // O upload de capa (mainImage) trafega o arquivo no corpo da Server Action.
      // O default é 1MB e cortaria imagens reais; o limite de negócio é 4MB
      // (revalidado no servidor em `assets.uploadImageAsset` e na própria action).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
