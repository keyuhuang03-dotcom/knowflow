import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ] }];
  },
  experimental: { proxyClientMaxBodySize: "26mb" },
  images: {
    // Learning images are served locally; no external optimizer fetches.
    remotePatterns: [],
  },
  // Allow phones on private networks to load dev assets and hydrate even when
  // the computer's DHCP address changes. Keep these as hostnames (no ports).
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "192.168.*.*",
    "172.20.10.*",
    "10.*.*.*",
  ],
};

export default nextConfig;
