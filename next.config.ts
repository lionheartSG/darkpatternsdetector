import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium-min", "playwright-core"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
