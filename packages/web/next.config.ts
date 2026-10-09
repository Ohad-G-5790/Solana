import type { NextConfig } from "next";

// Two build modes:
//  - default: Node server with API routes that read ../../data/runs (local dev, Vercel)
//  - NEXT_OUTPUT=export: fully static site (GitHub Pages); the API folder is
//    hidden by scripts/build-static.mjs and the client falls back to the
//    bundled run in public/demo. NEXT_PUBLIC_BASE_PATH="/Solana" for project pages.
const isExport = process.env.NEXT_OUTPUT === "export";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: isExport ? "export" : undefined,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  trailingSlash: isExport,
  images: { unoptimized: true },
  // Pure TypeScript modules shared with the agents (planner, approvals, geo).
  transpilePackages: ["@greenroom/agents", "@greenroom/world"],
  // Anchor ships CommonJS; let Node load it natively when pages render on the
  // server instead of bundling it as ESM ("exports is not defined").
  serverExternalPackages: ["@anchor-lang/core"],
  outputFileTracingIncludes: isExport ? undefined : { "/api/**": ["../../data/**"] },
  turbopack: {},
};

export default nextConfig;
