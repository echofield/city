import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Allow frontend (e.g. city-vme8.vercel.app) to call API from another origin.
    const origin = process.env.ALLOWED_ORIGINS ?? "*";
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: origin },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },
};

export default nextConfig;
