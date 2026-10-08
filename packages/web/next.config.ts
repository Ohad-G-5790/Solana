import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The dashboard reads run transcripts from ../../data at request time (dev / self-hosted);
  // on static hosts it falls back to the bundled demo run in public/demo.
  outputFileTracingIncludes: { "/api/**": ["../../data/**"] },
  turbopack: {},
};

export default nextConfig;
