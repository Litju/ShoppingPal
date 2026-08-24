import { defineConfig, loadEnv } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV || "development", process.cwd());

function secret(name: string, developmentFallback: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be configured in production.`);
  }
  return developmentFallback;
}

const stripeApiKey = process.env.STRIPE_API_KEY?.trim();
if (stripeApiKey && !stripeApiKey.startsWith("sk_test_")) {
  throw new Error("STRIPE_API_KEY must be a Stripe test-mode secret key.");
}

export default defineConfig({
  admin: {
    // Backend-only commerce service; the storefront is apps/web and there
    // is no operator dashboard in the converged topology.
    disable: true,
  },
  projectConfig: {
    workerMode: (process.env.MEDUSA_WORKER_MODE ?? "shared") as
      | "shared"
      | "server"
      | "worker",
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS ?? "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS ?? "http://localhost:7001",
      authCors: process.env.AUTH_CORS ?? "http://localhost:3000,http://localhost:9000",
      jwtSecret: secret("JWT_SECRET", "shoppingpal-dev-jwt-secret-not-for-production"),
      cookieSecret: secret("COOKIE_SECRET", "shoppingpal-dev-cookie-secret-not-for-production"),
    },
  },
  modules: [
    ...(stripeApiKey
      ? [
          {
            resolve: "@medusajs/medusa/payment",
            options: {
              providers: [
                {
                  resolve: "@medusajs/payment-stripe",
                  id: "stripe",
                  options: {
                    apiKey: stripeApiKey,
                    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
                    capture: process.env.STRIPE_CAPTURE !== "false",
                  },
                },
              ],
            },
          },
        ]
      : []),
  ],
});
