-- Foreign keys to Supabase's auth.users.
-- Declared here (not via Drizzle) so drizzle-kit doesn't try to manage the
-- auth schema. ON DELETE CASCADE means deleting a Supabase auth user wipes
-- all of their app data.

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "user_node_progress"
  ADD CONSTRAINT "user_node_progress_user_id_auth_users_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "user_card_state"
  ADD CONSTRAINT "user_card_state_user_id_auth_users_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "user_events"
  ADD CONSTRAINT "user_events_user_id_auth_users_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "tutor_messages"
  ADD CONSTRAINT "tutor_messages_user_id_auth_users_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_user_id_auth_users_fk"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- Enable Row Level Security on every public table.

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "nodes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "node_prerequisites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "skill_cards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_node_progress" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_card_state" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tutor_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- ---------- profiles: own-row select / update / insert ----------

CREATE POLICY "profiles_select_own" ON "profiles"
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles"
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "profiles_insert_own" ON "profiles"
  FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
--> statement-breakpoint

-- ---------- user-owned tables: full CRUD on rows where user_id = auth.uid() ----------

CREATE POLICY "user_node_progress_owner_all" ON "user_node_progress"
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "user_card_state_owner_all" ON "user_card_state"
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "user_events_owner_all" ON "user_events"
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
--> statement-breakpoint
CREATE POLICY "tutor_messages_owner_all" ON "tutor_messages"
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
--> statement-breakpoint

-- ---------- subscriptions: read-only from client; writes via service role ----------

CREATE POLICY "subscriptions_select_own" ON "subscriptions"
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
--> statement-breakpoint

-- ---------- catalog tables: read for any authenticated user, no client writes ----------

CREATE POLICY "roles_select_authenticated" ON "roles"
  FOR SELECT TO authenticated
  USING (true);
--> statement-breakpoint
CREATE POLICY "nodes_select_authenticated" ON "nodes"
  FOR SELECT TO authenticated
  USING (true);
--> statement-breakpoint
CREATE POLICY "node_prerequisites_select_authenticated" ON "node_prerequisites"
  FOR SELECT TO authenticated
  USING (true);
--> statement-breakpoint
CREATE POLICY "skill_cards_select_authenticated" ON "skill_cards"
  FOR SELECT TO authenticated
  USING (true);
