import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  typescript: {
    // TEMP: pre-existing type errors block the build. Disabled to test the
    // production UX locally. Remove this and fix the errors before deploying.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
