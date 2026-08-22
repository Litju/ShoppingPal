import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@electric-sql/pglite",
    "postgres",
    "@neondatabase/serverless",
    "better-auth",
  ],
};

export default nextConfig;
