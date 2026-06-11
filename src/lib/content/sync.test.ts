/**
 * Unit-тесты для чистых функций из sync.ts.
 * Не требуют DB — тестируем только проекцию MDX → карточки.
 */
import { describe, it, expect } from "vitest";

import { formatMcqAnswer, projectMdxToCards } from "./sync";

// ---------- formatMcqAnswer ----------

describe("formatMcqAnswer", () => {
  it("помечает правильный вариант жирным + ✓", () => {
    const result = formatMcqAnswer(["Нет", "Да", "Может быть"], 1, "Потому что да.");
    expect(result).toContain("**Да** ✓");
    expect(result).not.toContain("**Нет**");
    expect(result).not.toContain("**Может быть**");
  });

  it("включает explanation после пустой строки", () => {
    const result = formatMcqAnswer(["A", "B"], 0, "Объяснение здесь.");
    // Пустая строка между списком и объяснением
    expect(result).toMatch(/\n\nОбъяснение здесь\.$/);
  });

  it("первый вариант — правильный (answerIndex=0)", () => {
    const result = formatMcqAnswer(["Верно", "Неверно"], 0, "explanation");
    expect(result).toMatch(/^- \*\*Верно\*\* ✓/);
    expect(result).toContain("\n- Неверно\n");
  });

  it("последний вариант — правильный", () => {
    const result = formatMcqAnswer(["A", "B", "C"], 2, "explanation");
    expect(result).toContain("- A\n");
    expect(result).toContain("- B\n");
    expect(result).toContain("**C** ✓\n");
  });
});

// ---------- projectMdxToCards ----------

describe("projectMdxToCards", () => {
  const flashcards = [
    { front: "Что такое JVM?", back: "Виртуальная машина Java." },
    { front: "Что такое JIT?", back: "Just-In-Time компилятор." },
  ];

  const masteryQuiz = [
    {
      prompt: "Какой GC default в Java 11?",
      options: ["Serial", "G1", "ZGC"],
      answerIndex: 1,
      explanation: "G1 стал default с Java 9.",
    },
  ];

  const practiceMcq = [
    {
      kind: "mcq" as const,
      prompt: "Что делает volatile?",
      options: ["Атомарность", "Видимость", "Оба"],
      answerIndex: 1,
      explanation: "volatile гарантирует видимость, но не атомарность.",
    },
  ];

  const practiceCode = [
    {
      kind: "code" as const,
      prompt: "Напишите hello world",
      starterFile: "starter.java",
      solutionFile: "solution.java",
    },
  ];

  it("включает flashcards с kind=flashcard", () => {
    const cards = projectMdxToCards(flashcards, [], []);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      prompt: "Что такое JVM?",
      answerMarkdown: "Виртуальная машина Java.",
      kind: "flashcard",
    });
    expect(cards[1]?.kind).toBe("flashcard");
  });

  it("включает masteryQuiz с kind=mcq и правильным форматом", () => {
    const cards = projectMdxToCards([], masteryQuiz, []);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.kind).toBe("mcq");
    expect(card.prompt).toBe("Какой GC default в Java 11?");
    expect(card.answerMarkdown).toContain("**G1** ✓");
    expect(card.answerMarkdown).toContain("G1 стал default с Java 9.");
  });

  it("включает practice MCQ с kind=mcq", () => {
    const cards = projectMdxToCards([], [], practiceMcq);
    expect(cards).toHaveLength(1);
    const card = cards[0]!;
    expect(card.kind).toBe("mcq");
    expect(card.answerMarkdown).toContain("**Видимость** ✓");
  });

  it("пропускает practice code-items", () => {
    const cards = projectMdxToCards([], [], practiceCode);
    expect(cards).toHaveLength(0);
  });

  it("объединяет все источники в правильном порядке", () => {
    const cards = projectMdxToCards(flashcards, masteryQuiz, [...practiceMcq, ...practiceCode]);
    // 2 flashcards + 1 masteryQuiz + 1 practice MCQ (code пропускается)
    expect(cards).toHaveLength(4);
    expect(cards[0]?.kind).toBe("flashcard");
    expect(cards[1]?.kind).toBe("flashcard");
    expect(cards[2]?.kind).toBe("mcq");
    expect(cards[3]?.kind).toBe("mcq");
  });

  it("возвращает пустой массив для пустых входов", () => {
    const cards = projectMdxToCards([], [], []);
    expect(cards).toHaveLength(0);
  });

  it("formatMcqAnswer совпадает с логикой seed-java-middle-prod.mjs", () => {
    // seed-java-middle-prod.mjs строка ~144:
    //   const opts = m.options.map((o, i) => (i === m.answerIndex ? `**${o}** ✓` : o)).join("\n- ");
    //   answer_markdown: `- ${opts}\n\n${m.explanation}`
    const opts = ["A", "B", "C"]
      .map((o, i) => (i === 1 ? `**${o}** ✓` : o))
      .join("\n- ");
    const expected = `- ${opts}\n\nexplanation`;
    const actual = formatMcqAnswer(["A", "B", "C"], 1, "explanation");
    expect(actual).toBe(expected);
  });
});
