import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });
loadDotenv();

import { syncContent } from "@/lib/content/sync";

async function main() {
  console.log("→ syncing MDX flashcards into skill_cards…");
  const stats = await syncContent();
  console.log(
    `✓ done: roles=${stats.rolesScanned}, nodes=${stats.nodesScanned}, ` +
      `inserted=${stats.cardsInserted}, updated=${stats.cardsUpdated}, ` +
      `deleted=${stats.cardsDeleted}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("content sync failed:", err);
    process.exit(1);
  });
