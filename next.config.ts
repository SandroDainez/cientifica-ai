import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/**': ['./lib/ai/prompts/secoes/**/*.md'],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
