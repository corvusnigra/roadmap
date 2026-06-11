import { beforeEach, describe, expect, it, vi } from "vitest";

// Мокаем db и userEvents до импорта модуля — иначе drizzle пытается
// открыть реальное соединение с Postgres.
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
  },
  schema: {},
}));

vi.mock("@/db/schema", () => ({
  userEvents: {
    userId: "userId",
    verb: "verb",
    createdAt: "createdAt",
  },
}));

// server-only мок — модуль просто экспортирует пустышку
vi.mock("server-only", () => ({}));

// drizzle-операторы мокаем, чтобы они просто возвращали себя (builder-pattern).
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  count: () => ({ _count: true }),
  eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
  gte: (a: unknown, b: unknown) => ({ gte: [a, b] }),
}));

import { checkRateLimit } from "./rate-limit";
import { db } from "@/lib/db";

// Вспомогательная функция: настраивает цепочку select().from().where() → count
function mockDbCount(n: number) {
  const whereMock = vi.fn().mockResolvedValue([{ n }]);
  const fromMock = vi.fn().mockReturnValue({ where: whereMock });
  const selectMock = vi.fn().mockReturnValue({ from: fromMock });
  vi.mocked(db.select).mockImplementation(selectMock);
  return { selectMock, fromMock, whereMock };
}

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("разрешает запрос когда использовано меньше лимита", async () => {
    mockDbCount(5);
    const result = await checkRateLimit({
      userId: "user-1",
      verb: "tutor_message_sent",
      windowSeconds: 600,
      limit: 20,
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(5);
    expect(result.limit).toBe(20);
    expect(result.windowSeconds).toBe(600);
  });

  it("разрешает запрос когда использовано ровно limit-1", async () => {
    mockDbCount(19);
    const result = await checkRateLimit({
      userId: "user-1",
      verb: "tutor_message_sent",
      windowSeconds: 600,
      limit: 20,
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(19);
  });

  it("блокирует запрос когда использовано ровно limit", async () => {
    mockDbCount(20);
    const result = await checkRateLimit({
      userId: "user-1",
      verb: "tutor_message_sent",
      windowSeconds: 600,
      limit: 20,
    });
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(20);
  });

  it("блокирует запрос когда использовано больше лимита", async () => {
    mockDbCount(31);
    const result = await checkRateLimit({
      userId: "user-1",
      verb: "concept_explain",
      windowSeconds: 600,
      limit: 30,
    });
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(31);
  });

  it("возвращает used=0 когда база вернула пустой массив", async () => {
    const whereMock = vi.fn().mockResolvedValue([]);
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    vi.mocked(db.select).mockReturnValue(
      { from: fromMock } as unknown as ReturnType<typeof db.select>,
    );

    const result = await checkRateLimit({
      userId: "user-1",
      verb: "concept_explain",
      windowSeconds: 600,
      limit: 30,
    });
    expect(result.allowed).toBe(true);
    expect(result.used).toBe(0);
  });
});
