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
    "better-auth",
  ],
};

export default nextConfig;
