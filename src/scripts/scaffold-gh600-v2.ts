/**
 * Перегенератор MDX-узлов для роли GH-600 на основе обогащённого
 * curriculum'а (`gh600-curriculum.ts`). В отличие от первой версии
 * scaffold-gh600.ts (которая писала только заглушки по syllabus'у),
 * здесь каждый узел получает полное D/T/P-наполнение: тело теории
 * (## Зачем / Различения / Инструменты / Практика / Маркеры / Анти-
 * паттерны / Где в стеке), 6 flashcards и 6 mastery MCQ — всё из
 * source-полей.
 *
 * Идемпотентен: если MDX уже существует, пропускает (не перезатирает).
 * Это сохраняет hand-crafted узлы вроде agent-sdlc-integration.mdx,
 * который был дописан вручную раньше.
 *
 *   pnpm tsx src/scripts/scaffold-gh600-v2.ts
 *
 * Чтобы регенерировать конкретный узел — сначала удалить его MDX,
 * потом запустить.
 */

import { writeFile, mkdir, access, constants } from "node:fs/promises";
import path from "node:path";

import { GH600_DISCIPLINES, GH600_LEVELS } from "@/scripts/gh600-curriculum";
import type { LDiscipline } from "@/scripts/levenchuk-curriculum";

const ROLE_SLUG = "agentic-ai-gh600";
const ROLE_DIR = path.join(
  process.cwd(),
  "src",
  "content",
  "roles",
  ROLE_SLUG,
);

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// ---------- flashcards --------------------------------------------------

interface Flashcard {
  front: string;
  back: string;
}

function buildFlashcards(d: LDiscipline): Flashcard[] {
  const cards: Flashcard[] = [];
  const seed = d.what.split(". ").filter((s) => s.length > 30);
  const sentence = (i: number) => seed[i] ?? d.what;

  for (const distinction of d.diff ?? []) {
    if (cards.length >= 6) break;
    cards.push({
      front: `Что стоит за различением «${distinction}»?`,
      back: `${distinction}. ${sentence(cards.length)}`,
    });
  }
  for (const marker of d.markers ?? []) {
    if (cards.length >= 6) break;
    cards.push({
      front: `По какому маркеру понять, что освоено: «${marker}»?`,
      back: marker,
    });
  }
  for (const pr of d.practice ?? []) {
    if (cards.length >= 6) break;
    cards.push({ front: `Что даёт практика «${pr}»?`, back: pr });
  }
  while (cards.length < 6) {
    cards.push({ front: d.question, back: d.what });
  }
  return cards;
}

// ---------- practice + mastery quiz -------------------------------------

interface McqStub {
  prompt: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

const UNIVERSAL_FILLERS = [
  "Это не имеет прямого отношения к дисциплине",
  "Это симптом, а не дисциплина",
  "Это касается только инструментов, но не сути",
  "Этот вариант не упоминается в материалах",
];

function pickFour(items: string[], correct: string): string[] {
  const distractors: string[] = [];
  const seen = new Set<string>([correct]);
  for (const x of items) {
    if (distractors.length >= 3) break;
    if (seen.has(x)) continue;
    distractors.push(x);
    seen.add(x);
  }
  const result = [correct, ...distractors];
  let fillerIdx = 0;
  while (result.length < 4) {
    const filler =
      UNIVERSAL_FILLERS[fillerIdx++] ?? `Вариант ${result.length + 1}`;
    if (seen.has(filler)) continue;
    result.push(filler);
    seen.add(filler);
  }
  return result;
}

function buildPracticeMcq(d: LDiscipline): McqStub {
  const correctMarker = d.markers?.[0] ?? `Регулярная практика «${d.title}»`;
  const wrongs = [
    ...(d.anti ?? []),
    "Прочитать syllabus и считать дисциплину освоенной",
    "Упомянуть термин на код-ревью, не применяя на практике",
  ];
  return {
    prompt: `По какому из признаков честно судить, что дисциплина «${d.title}» начала работать?`,
    options: pickFour([correctMarker, ...wrongs.slice(0, 3)], correctMarker),
    answerIndex: 0,
    explanation:
      `Маркер освоения — наблюдаемое поведение, которое появляется регулярно. ` +
      `«${correctMarker}» — именно такой признак.`,
  };
}

function buildMasteryQuizStubs(d: LDiscipline): McqStub[] {
  const out: McqStub[] = [];

  {
    const correct = d.question;
    const wrongs = [
      ...(d.anti ?? []),
      "Это про конкретный GitHub feature, а не подход",
      "Это синоним «работы с LLM» в целом",
    ];
    out.push({
      prompt: `Какой вопрос ставит дисциплина «${d.title}» в центр?`,
      options: pickFour([correct, ...wrongs], correct),
      answerIndex: 0,
      explanation: `Дисциплина задаёт фокусирующий вопрос — он определяет, что считать работой, а что — её имитацией. Здесь это: «${d.question}»`,
    });
  }

  {
    const anti = d.anti?.[0];
    const practice = d.practice?.[0];
    if (anti && practice) {
      out.push({
        prompt: `Что из перечисленного — антипаттерн дисциплины «${d.title}»?`,
        options: pickFour(
          [anti, practice, ...(d.markers ?? []), ...(d.tech ?? [])],
          anti,
        ),
        answerIndex: 0,
        explanation: `Антипаттерн — типовой способ имитировать дисциплину, не осваивая её. В материалах он отмечен явно: «${anti}»`,
      });
    }
  }

  {
    const distinction = d.diff?.[0];
    if (distinction) {
      out.push({
        prompt: `Какое из утверждений — ключевое различение в «${d.title}»?`,
        options: pickFour(
          [
            distinction,
            ...(d.anti ?? []),
            "Все термины здесь — синонимы",
            "Это вопрос стиля, а не сути",
          ],
          distinction,
        ),
        answerIndex: 0,
        explanation: `Различение «${distinction}» лежит в основе дисциплины и определяет, как видеть её объекты.`,
      });
    }
  }

  {
    const practice = d.practice?.[0];
    if (practice) {
      out.push({
        prompt: `Какое действие в основе регулярной практики «${d.title}»?`,
        options: pickFour(
          [
            practice,
            ...(d.anti ?? []),
            "Однократно прочитать syllabus",
            "Упомянуть на ретро один раз",
          ],
          practice,
        ),
        answerIndex: 0,
        explanation: `Регулярная практика — то, что превращает знание в навык. Здесь это: «${practice}»`,
      });
    }
  }

  {
    const marker = d.markers?.[0];
    if (marker) {
      out.push({
        prompt: `По какому маркеру судить, что «${d.title}» работает?`,
        options: pickFour(
          [
            marker,
            ...(d.anti ?? []),
            "Появилось ощущение уверенности",
            "Можешь пересказать определение наизусть",
          ],
          marker,
        ),
        answerIndex: 0,
        explanation: `Маркер освоения — наблюдаемое поведение: «${marker}». Не ощущение, а действие.`,
      });
    }
  }

  {
    const tech = d.tech?.[0];
    const secondDiff = d.diff?.[1];
    if (tech) {
      out.push({
        prompt: `Какой инструмент использует дисциплина «${d.title}» как опору?`,
        options: pickFour(
          [
            tech,
            ...(d.anti ?? []),
            "Только устная коммуникация без артефактов",
            "Любая популярная методика без привязки к задаче",
          ],
          tech,
        ),
        answerIndex: 0,
        explanation: `Шаблон или инструмент удерживает дисциплину между сессиями. Здесь это: «${tech}»`,
      });
    } else if (secondDiff) {
      out.push({
        prompt: `Какое из утверждений отражает второе ключевое различение в «${d.title}»?`,
        options: pickFour(
          [
            secondDiff,
            ...(d.anti ?? []),
            "Это вопрос стиля, а не сути",
            "Это касается только инструментов",
          ],
          secondDiff,
        ),
        answerIndex: 0,
        explanation: `Различение «${secondDiff}» расширяет понимание дисциплины за пределы базового вопроса.`,
      });
    }
  }

  while (out.length < 6) {
    out.push({
      prompt: `Что точнее всего описывает суть «${d.title}»?`,
      options: pickFour(
        [
          d.question,
          "Это формальная процедура с фиксированным выходом",
          "Это требование к LLM, а не к разработчику",
          "Это набор технологий без собственной сути",
        ],
        d.question,
      ),
      answerIndex: 0,
      explanation: d.what,
    });
  }

  return out.slice(0, 6);
}

function buildOutcomes(d: LDiscipline): string[] {
  const out: string[] = [];
  for (const m of d.markers ?? []) {
    if (out.length >= 5) break;
    out.push(m);
  }
  for (const p of d.practice ?? []) {
    if (out.length >= 5) break;
    out.push(`Выполнять регулярно: ${p}`);
  }
  while (out.length < 3) {
    out.push(`Понимать, что ставит в центр вопрос: «${d.question}»`);
  }
  return out;
}

// ---------- MDX ---------------------------------------------------------

function bulletList(items?: string[]): string {
  if (!items || items.length === 0) return "";
  return items.map((x) => `- ${x}`).join("\n");
}

function yamlList(items: string[], indent = "  "): string {
  return items.map((x) => `${indent}- ${JSON.stringify(x)}`).join("\n");
}

function mdxTemplate(d: LDiscipline): string {
  const flashcards = buildFlashcards(d);
  const practice = buildPracticeMcq(d);
  const mastery = buildMasteryQuizStubs(d);
  const outcomes = buildOutcomes(d);
  const level = GH600_LEVELS[d.level]!;

  const flashcardsYaml = flashcards
    .map(
      (c) =>
        `  - front: ${JSON.stringify(c.front)}\n    back: ${JSON.stringify(c.back)}`,
    )
    .join("\n");

  const masteryYaml = mastery
    .map(
      (m) =>
        `  - kind: mcq\n    prompt: ${JSON.stringify(m.prompt)}\n    options:\n${m.options
          .map((o) => `      - ${JSON.stringify(o)}`)
          .join("\n")}\n    answerIndex: ${m.answerIndex}\n    explanation: ${JSON.stringify(m.explanation)}`,
    )
    .join("\n");

  const practiceYaml = `  - kind: mcq\n    prompt: ${JSON.stringify(practice.prompt)}\n    options:\n${practice.options
    .map((o) => `      - ${JSON.stringify(o)}`)
    .join("\n")}\n    answerIndex: ${practice.answerIndex}\n    explanation: ${JSON.stringify(practice.explanation)}`;

  const front = `---
schemaVersion: 1
slug: ${d.slug}
title: ${JSON.stringify(d.title)}
summary: ${JSON.stringify(d.question)}
status: draft
estimatedMinutes: ${d.estimatedMinutes}
prerequisites: []
learningOutcomes:
${yamlList(outcomes)}
practice:
${practiceYaml}
flashcards:
${flashcardsYaml}
masteryQuiz:
${masteryYaml}
---`;

  const sections: string[] = [];
  sections.push(`## Зачем\n\n${d.what}`);

  if (d.diff && d.diff.length > 0) {
    sections.push(`## Ключевые различения\n\n${bulletList(d.diff)}`);
  }
  if (d.tech && d.tech.length > 0) {
    sections.push(`## Инструменты\n\n${bulletList(d.tech)}`);
  }
  if (d.practice && d.practice.length > 0) {
    sections.push(`## Практика\n\n${bulletList(d.practice)}`);
  }
  if (d.markers && d.markers.length > 0) {
    sections.push(`## Маркеры освоения\n\n${bulletList(d.markers)}`);
  }
  if (d.anti && d.anti.length > 0) {
    sections.push(`## Антипаттерны\n\n${bulletList(d.anti)}`);
  }
  sections.push(
    `## Где в стеке\n\n**${level.title}.** ${level.intro}`,
  );

  return `${front}\n\n${sections.join("\n\n")}\n`;
}

async function main() {
  if (!(await exists(ROLE_DIR))) {
    await mkdir(ROLE_DIR, { recursive: true });
  }

  let created = 0;
  let skipped = 0;
  for (const d of GH600_DISCIPLINES) {
    const filePath = path.join(ROLE_DIR, `${d.slug}.mdx`);
    if (await exists(filePath)) {
      console.log(`· skip ${d.slug} (already exists)`);
      skipped++;
      continue;
    }
    await writeFile(filePath, mdxTemplate(d), "utf8");
    console.log(`✓ ${d.slug}`);
    created++;
  }

  console.log("");
  console.log(`Done: ${created} created, ${skipped} skipped.`);
}

if (process.argv[1] && process.argv[1].includes("scaffold-gh600-v2")) {
  main().catch((err) => {
    console.error(
      "scaffold-gh600-v2 failed:",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
}
