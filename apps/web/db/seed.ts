import { ensureSeeded } from "@/lib/db/seed";

async function main() {
  const { getDatabase } = await import("@/lib/db");
  const { db, kind } = await getDatabase();
  console.log(`Seeding catalog (${kind})...`);
  const written = await ensureSeeded(db);
  if (!written) {
    console.log("Catalog not empty — nothing to do. Use a fresh database to reseed.");
  } else {
    console.log("Seed complete.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
