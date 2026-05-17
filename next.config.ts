import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
    allowedDevOrigins: ['192.168.178.79'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};


export default nextConfig;
