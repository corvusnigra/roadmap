import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";

import {
  nodePrerequisites,
  nodeProgressStatusEnum,
  nodes,
  profiles,
  roleStatusEnum,
  roles,
  skillCardKindEnum,
  skillCards,
  subscriptionStatusEnum,
  subscriptions,
  tutorMessageRoleEnum,
  tutorMessages,
  userCardState,
  userEvents,
  userNodeProgress,
} from "@/db/schema";

describe("db schema enums", () => {
  it("role_status has expected values", () => {
    expect(roleStatusEnum.enumValues).toEqual(["draft", "published", "archived"]);
  });

  it("node_progress_status has expected values", () => {
    expect(nodeProgressStatusEnum.enumValues).toEqual([
      "locked",
      "in_progress",
      "mastered",
    ]);
  });

  it("skill_card_kind has expected values", () => {
    expect(skillCardKindEnum.enumValues).toEqual(["flashcard", "cloze", "mcq"]);
  });

  it("tutor_message_role has expected values", () => {
    expect(tutorMessageRoleEnum.enumValues).toEqual([
      "user",
      "assistant",
      "system",
    ]);
  });

  it("subscription_status mirrors Stripe statuses", () => {
    expect(subscriptionStatusEnum.enumValues).toEqual([
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "incomplete",
      "incomplete_expired",
      "paused",
    ]);
  });
});

describe("db schema tables", () => {
  it("profiles has required columns", () => {
    expect(getTableName(profiles)).toBe("profiles");
    const cols = getTableColumns(profiles);
    expect(Object.keys(cols).sort()).toEqual(
      ["createdAt", "displayName", "id", "timezone"].sort(),
    );
  });

  it("roles has required columns", () => {
    expect(getTableName(roles)).toBe("roles");
    const cols = getTableColumns(roles);
    for (const key of ["id", "slug", "title", "summary", "status", "createdAt"]) {
      expect(cols).toHaveProperty(key);
    }
  });

  it("nodes has required columns", () => {
    expect(getTableName(nodes)).toBe("nodes");
    const cols = getTableColumns(nodes);
    for (const key of [
      "id",
      "roleId",
      "slug",
      "title",
      "summary",
      "positionX",
      "positionY",
      "estimatedMinutes",
      "mandatory",
    ]) {
      expect(cols).toHaveProperty(key);
    }
  });

  it("node_prerequisites has composite key columns", () => {
    expect(getTableName(nodePrerequisites)).toBe("node_prerequisites");
    const cols = getTableColumns(nodePrerequisites);
    expect(Object.keys(cols).sort()).toEqual(
      ["nodeId", "prerequisiteNodeId"].sort(),
    );
  });

  it("skill_cards has required columns", () => {
    expect(getTableName(skillCards)).toBe("skill_cards");
    const cols = getTableColumns(skillCards);
    for (const key of ["id", "nodeId", "prompt", "answerMarkdown", "kind"]) {
      expect(cols).toHaveProperty(key);
    }
  });

  it("user_node_progress has required columns", () => {
    expect(getTableName(userNodeProgress)).toBe("user_node_progress");
    const cols = getTableColumns(userNodeProgress);
    for (const key of [
      "userId",
      "nodeId",
      "status",
      "masteryScore",
      "startedAt",
      "masteredAt",
    ]) {
      expect(cols).toHaveProperty(key);
    }
  });

  it("user_card_state has FSRS columns", () => {
    expect(getTableName(userCardState)).toBe("user_card_state");
    const cols = getTableColumns(userCardState);
    for (const key of [
      "userId",
      "cardId",
      "stability",
      "difficulty",
      "dueAt",
      "reps",
      "lapses",
      "lastReviewAt",
    ]) {
      expect(cols).toHaveProperty(key);
    }
  });

  it("user_events captures xAPI-like fields", () => {
    expect(getTableName(userEvents)).toBe("user_events");
    const cols = getTableColumns(userEvents);
    for (const key of [
      "id",
      "userId",
      "verb",
      "objectType",
      "objectId",
      "payload",
      "createdAt",
    ]) {
      expect(cols).toHaveProperty(key);
    }
  });

  it("tutor_messages stores chat history", () => {
    expect(getTableName(tutorMessages)).toBe("tutor_messages");
    const cols = getTableColumns(tutorMessages);
    for (const key of ["id", "userId", "nodeId", "role", "content", "createdAt"]) {
      expect(cols).toHaveProperty(key);
    }
  });

  it("subscriptions is keyed by user_id with Stripe ids", () => {
    expect(getTableName(subscriptions)).toBe("subscriptions");
    const cols = getTableColumns(subscriptions);
    for (const key of [
      "userId",
      "stripeCustomerId",
      "stripeSubscriptionId",
      "status",
      "currentPeriodEnd",
    ]) {
      expect(cols).toHaveProperty(key);
    }
  });
});
