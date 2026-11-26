import type { NextConfig } from "next";

// Cache Components ist bewusst aus: Alle Seiten hängen vom Login ab (Cookie)
// und werden pro Request gerendert. Siehe CLAUDE.md.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
