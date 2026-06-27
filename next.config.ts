import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "playwright-core"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
