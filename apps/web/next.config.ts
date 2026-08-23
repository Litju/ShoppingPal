import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@shoppingpal/contracts",
    "@shoppingpal/ui",
    "@shoppingpal/test-utils",
  ],
  serverExternalPackages: [
    "@electric-sql/pglite",
    "postgres",
    "@neondatabase/serverless",
  ],
};

export default nextConfig;
