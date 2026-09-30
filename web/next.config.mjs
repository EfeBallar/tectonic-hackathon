/** @type {import('next').NextConfig} */

// The live tab talks to kate-api (Cloud Run) through this same-origin path, so the browser never
// needs CORS and the API URL stays server config. Example: KATE_API_URL=https://kate-api-xyz.a.run.app
const KATE_API_URL = (process.env.KATE_API_URL || "").replace(/\/$/, "");

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return KATE_API_URL ? [{ source: "/kate/:path*", destination: `${KATE_API_URL}/:path*` }] : [];
  },
};
export default nextConfig;
