/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The /api proxy below waits for slow AI answers (free reasoning models can take 30-60 s).
  // Next's default proxy timeout is 30 s, which turned slow answers into HTTP 500 locally.
  experimental: { proxyTimeout: 120_000 },
  async rewrites() {
    // Local dev: the FastAPI server on :8000. On Vercel: the deployed backend (override with BACKEND_INTERNAL_URL).
    const fallback = process.env.VERCEL ? "https://gymbuddy-api-zeta.vercel.app" : "http://127.0.0.1:8000";
    const backend = (process.env.BACKEND_INTERNAL_URL || fallback).replace(/\/+$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
