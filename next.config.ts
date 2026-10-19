import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML export, deployed to GitHub Pages by .github/workflows/ci.yml.
  output: "export",
  images: { unoptimized: true },
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
