import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/api/**': ['./lib/ai/prompts/secoes/**/*.md'],
  },
};

export default nextConfig;
