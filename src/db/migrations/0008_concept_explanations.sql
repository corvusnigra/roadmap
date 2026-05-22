CREATE TABLE "concept_explanations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"concept" text NOT NULL,
	"concept_original" text NOT NULL,
	"explanation" text NOT NULL,
	"model_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concept_explanations_node_id_concept_unique" UNIQUE("node_id","concept")
);
--> statement-breakpoint
ALTER TABLE "concept_explanations" ADD CONSTRAINT "concept_explanations_node_id_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- ---------- concept_explanations: публичный кэш ----------
-- Объяснения концептов не привязаны к пользователю — это общий словарь.
-- Читают все (включая anon в демо-режиме). Пишет только сервер через
-- service-role; client-side INSERT/UPDATE заблокированы.
ALTER TABLE "concept_explanations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "concept_explanations_read_all" ON "concept_explanations"
  FOR SELECT TO anon, authenticated
  USING (true);