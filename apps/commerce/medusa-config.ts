import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

export default defineConfig({
  admin: {
    // Backend-only commerce service; the storefront is apps/web and there
    // is no operator dashboard in the converged topology.
    disable: true,
  },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS ?? "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS ?? "http://localhost:7001",
      authCors: process.env.AUTH_CORS ?? "http://localhost:3000,http://localhost:9000",
      jwtSecret: process.env.JWT_SECRET ?? "shoppingpal-dev-jwt-secret-not-for-production",
      cookieSecret: process.env.COOKIE_SECRET ?? "shoppingpal-dev-cookie-secret-not-for-production",
    },
  },
  modules: [
    ...(process.env.STRIPE_API_KEY
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "@medusajs/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: process.env.STRIPE_API_KEY,
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
});
