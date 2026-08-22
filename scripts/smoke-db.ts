async function main() {
  const { getDatabase } = await import("../lib/db");
  const { upsertSeedProducts } = await import("../lib/db/seed");
  try {
    const { db, kind } = await getDatabase();
    console.log("kind:", kind);
    const n = await upsertSeedProducts(db);
    console.log("seeded rows:", n);
    const res = await db.execute(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import("drizzle-orm")).sql`select count(*)::text as c from products`,
    );
    console.log("count:", JSON.stringify(res));
    process.exit(0);
  } catch (error) {
    console.error("FAILED:", error);
    process.exit(1);
  }
}
void main();
