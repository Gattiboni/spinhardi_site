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
      // O default é 1MB e cortaria imagens reais; o limite de negócio é 3MB
      // (revalidado no servidor em `assets.uploadImageAsset` e na própria action).
      // 3MB dá margem folgada contra o corte de ~4.5MB da Vercel no serverless.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
