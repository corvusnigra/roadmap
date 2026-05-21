import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// Foreign keys to Supabase's `auth.users(id)` are NOT declared via Drizzle —
// drizzle-kit would try to manage the auth schema. They are added by the
// hand-written migration `0001_rls_and_auth_fks.sql` instead.

// ---------- Enums ----------

export const roleStatusEnum = pgEnum("role_status", [
  "draft",
  "published",
  "archived",
]);

export const nodeProgressStatusEnum = pgEnum("node_progress_status", [
  "locked",
  "in_progress",
  "mastered",
]);

export const skillCardKindEnum = pgEnum("skill_card_kind", [
  "flashcard",
  "cloze",
  "mcq",
]);

export const tutorMessageRoleEnum = pgEnum("tutor_message_role", [
  "user",
  "assistant",
  "system",
]);

// Mirrors Stripe's subscription statuses.
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

// FSRS scheduler card states (ts-fsrs's State enum mirrored as Postgres enum).
export const cardStateEnum = pgEnum("card_state", [
  "new",
  "learning",
  "review",
  "relearning",
]);

// ---------- Tables ----------

export const profiles = pgTable("profiles", {
  // Matches auth.users.id 1:1. FK is added in the auth-fk migration.
  id: uuid("id").primaryKey(),
  displayName: text("display_name"),
  timezone: text("timezone").default("UTC").notNull(),
  // Which role's roadmap the user is currently studying. Updated via
  // `setActiveRole` server action; default keeps existing rows on the
  // original demo role.
  activeRoleSlug: text("active_role_slug")
    .default("frontend-developer")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  status: roleStatusEnum("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const nodes = pgTable("nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  roleId: uuid("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  positionX: integer("position_x").notNull().default(0),
  positionY: integer("position_y").notNull().default(0),
  estimatedMinutes: integer("estimated_minutes").notNull().default(20),
  mandatory: boolean("mandatory").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const nodePrerequisites = pgTable(
  "node_prerequisites",
  {
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    prerequisiteNodeId: uuid("prerequisite_node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.nodeId, table.prerequisiteNodeId] }),
  }),
);

export const skillCards = pgTable("skill_cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  answerMarkdown: text("answer_markdown").notNull(),
  kind: skillCardKindEnum("kind").notNull().default("flashcard"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userNodeProgress = pgTable(
  "user_node_progress",
  {
    userId: uuid("user_id").notNull(),
    nodeId: uuid("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    status: nodeProgressStatusEnum("status").notNull().default("locked"),
    masteryScore: doublePrecision("mastery_score"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    masteredAt: timestamp("mastered_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.nodeId] }),
  }),
);

export const userCardState = pgTable(
  "user_card_state",
  {
    userId: uuid("user_id").notNull(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => skillCards.id, { onDelete: "cascade" }),
    stability: doublePrecision("stability").notNull().default(0),
    difficulty: doublePrecision("difficulty").notNull().default(0),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
    reps: integer("reps").notNull().default(0),
    lapses: integer("lapses").notNull().default(0),
    lastReviewAt: timestamp("last_review_at", { withTimezone: true }),
    state: cardStateEnum("state").notNull().default("new"),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.cardId] }),
  }),
);

export const userEvents = pgTable("user_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  verb: text("verb").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tutorMessages = pgTable("tutor_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull(),
  nodeId: uuid("node_id")
    .notNull()
    .references(() => nodes.id, { onDelete: "cascade" }),
  role: tutorMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  modelId: text("model_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  userId: uuid("user_id").primaryKey(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: subscriptionStatusEnum("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ---------- Relations ----------

export const profilesRelations = relations(profiles, ({ many, one }) => ({
  progress: many(userNodeProgress),
  cardState: many(userCardState),
  events: many(userEvents),
  messages: many(tutorMessages),
  subscription: one(subscriptions, {
    fields: [profiles.id],
    references: [subscriptions.userId],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  nodes: many(nodes),
}));

export const nodesRelations = relations(nodes, ({ one, many }) => ({
  role: one(roles, { fields: [nodes.roleId], references: [roles.id] }),
  cards: many(skillCards),
  progress: many(userNodeProgress),
  outgoingPrereqs: many(nodePrerequisites, { relationName: "nodeToPrereqs" }),
  incomingPrereqs: many(nodePrerequisites, { relationName: "prereqToNodes" }),
  tutorMessages: many(tutorMessages),
}));

export const nodePrerequisitesRelations = relations(
  nodePrerequisites,
  ({ one }) => ({
    node: one(nodes, {
      fields: [nodePrerequisites.nodeId],
      references: [nodes.id],
      relationName: "nodeToPrereqs",
    }),
    prerequisite: one(nodes, {
      fields: [nodePrerequisites.prerequisiteNodeId],
      references: [nodes.id],
      relationName: "prereqToNodes",
    }),
  }),
);

export const skillCardsRelations = relations(skillCards, ({ one, many }) => ({
  node: one(nodes, { fields: [skillCards.nodeId], references: [nodes.id] }),
  state: many(userCardState),
}));

export const userNodeProgressRelations = relations(
  userNodeProgress,
  ({ one }) => ({
    profile: one(profiles, {
      fields: [userNodeProgress.userId],
      references: [profiles.id],
    }),
    node: one(nodes, {
      fields: [userNodeProgress.nodeId],
      references: [nodes.id],
    }),
  }),
);

export const userCardStateRelations = relations(userCardState, ({ one }) => ({
  profile: one(profiles, {
    fields: [userCardState.userId],
    references: [profiles.id],
  }),
  card: one(skillCards, {
    fields: [userCardState.cardId],
    references: [skillCards.id],
  }),
}));

export const userEventsRelations = relations(userEvents, ({ one }) => ({
  profile: one(profiles, {
    fields: [userEvents.userId],
    references: [profiles.id],
  }),
}));

export const tutorMessagesRelations = relations(tutorMessages, ({ one }) => ({
  profile: one(profiles, {
    fields: [tutorMessages.userId],
    references: [profiles.id],
  }),
  node: one(nodes, {
    fields: [tutorMessages.nodeId],
    references: [nodes.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  profile: one(profiles, {
    fields: [subscriptions.userId],
    references: [profiles.id],
  }),
}));

// ---------- Inferred types ----------

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type Node = typeof nodes.$inferSelect;
export type NewNode = typeof nodes.$inferInsert;

export type NodePrerequisite = typeof nodePrerequisites.$inferSelect;
export type NewNodePrerequisite = typeof nodePrerequisites.$inferInsert;

export type SkillCard = typeof skillCards.$inferSelect;
export type NewSkillCard = typeof skillCards.$inferInsert;

export type UserNodeProgress = typeof userNodeProgress.$inferSelect;
export type NewUserNodeProgress = typeof userNodeProgress.$inferInsert;

export type UserCardState = typeof userCardState.$inferSelect;
export type NewUserCardState = typeof userCardState.$inferInsert;

export type UserEvent = typeof userEvents.$inferSelect;
export type NewUserEvent = typeof userEvents.$inferInsert;

export type TutorMessage = typeof tutorMessages.$inferSelect;
export type NewTutorMessage = typeof tutorMessages.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
