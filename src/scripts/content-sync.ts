import { config as loadDotenv } from "dotenv";

loadDotenv({ path: ".env.local" });
loadDotenv();

import { syncContent } from "@/lib/content/sync";

async function main() {
  console.log("→ MDX-first sync (roles + nodes + edges + skill_cards)…");
  const stats = await syncContent();
  console.log(
    `✓ roles: ${stats.rolesUpserted}/${stats.rolesScanned} scanned, ` +
      `nodes: ${stats.nodesUpserted}/${stats.nodesScanned}, ` +
      `edges: ${stats.edgesUpserted}, ` +
      `cards: +${stats.cardsInserted} ~${stats.cardsUpdated} -${stats.cardsDeleted}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("content sync failed:", err);
    process.exit(1);
  });
