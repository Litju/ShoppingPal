/**
 * Runs once per server process at boot, before any request is served.
 * Warming the non-commerce state store here guarantees schema creation
 * finishes single-threaded — request-time lazy init would otherwise let
 * multiple route bundles race PGlite against the same data directory.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmDatabase } = await import("./lib/db");
    await warmDatabase();
  }
}
