-- Дедупликация существующих строк: оставляем по одной на (node_id, prompt, kind).
-- Без этого шага ALTER TABLE упадёт на prod, где несколько seed-путей
-- создали дубли (seed-java-middle-prod.mjs + content-sync-prod.mjs).
DELETE FROM "skill_cards"
WHERE id NOT IN (
  SELECT MIN(id)
  FROM "skill_cards"
  GROUP BY node_id, prompt, kind
);
--> statement-breakpoint
ALTER TABLE "skill_cards" ADD CONSTRAINT "skill_cards_node_id_prompt_kind_unique" UNIQUE("node_id","prompt","kind");
