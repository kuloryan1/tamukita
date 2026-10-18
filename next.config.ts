import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      // Personalized invitation URLs carry a bearer token in the query string.
      // Prevent subsequent same-origin requests from sending it as a Referer.
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-XSS-Protection", value: "0" },
    ];

    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Strict-Transport-Security", value: "max-age=31536000" });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
