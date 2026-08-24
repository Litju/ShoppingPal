import type { NextConfig } from "next";
import { withEve } from "eve/next";

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

export default withEve(nextConfig);
