/**
 * Versioned system prompt for the in-page tutor. Bump TUTOR_SYSTEM_PROMPT_VERSION
 * whenever the wording changes — the version is persisted with every
 * tutor_messages row so future audits can correlate behaviour to the prompt
 * that generated it.
 */
export const TUTOR_SYSTEM_PROMPT_VERSION = 2 as const;

/** Hard cap on Claude's output. Stops runaway costs and keeps replies focused. */
export const TUTOR_MAX_TOKENS = 1000;

/** Model id used for every tutor exchange. Recorded on each message. */
export const TUTOR_MODEL = "claude-sonnet-4-5";

/**
 * The refusal phrase the assistant must use verbatim when asked about
 * material outside the current node's context. Tests assert on this string.
 */
export const TUTOR_REFUSAL_PREFIX =
  "Это вне материала текущего узла — возвращайтесь после того, как пройдёте ";

export interface BuildSystemPromptInput {
  /** Title of the node the user is studying. */
  currentNodeTitle: string;
  /** Titles of every transitive prerequisite included in the context. */
  prerequisiteTitles: string[];
  /** Concatenated retrieved chunks (already truncated to a budget). */
  contextBlock: string;
  /** When true, the assistant is allowed to reveal the full code solution. */
  solveRequested: boolean;
}

export function buildSystemPrompt({
  currentNodeTitle,
  prerequisiteTitles,
  contextBlock,
  solveRequested,
}: BuildSystemPromptInput): string {
  const prereqLine =
    prerequisiteTitles.length > 0
      ? prerequisiteTitles.map((t) => `"${t}"`).join(", ")
      : "(нет)";

  return [
    "Вы — наставник RoleRoadmap. Помогаете учащемуся разобраться в текущем узле.",
    "Отвечайте на русском языке.",
    "",
    "СТРОГИЕ ПРАВИЛА",
    `1. Используйте ТОЛЬКО блок <context> ниже. Если ответа в нём нет, ответьте дословно: "${TUTOR_REFUSAL_PREFIX}<prereq>." Выберите наиболее подходящий заголовок из списка предшествующих тем; если подходящего нет — напишите "предшествующую тему этого узла".`,
    "2. Никогда не выдумывайте код, API, названия библиотек или команды, которых нет в контексте дословно.",
    "3. Когда учащийся застрял на задании, задайте ОДИН сократический вопрос, который подталкивает к следующему наблюдению. Не пишите ответ.",
    solveRequested
      ? "4. В последнем сообщении пользователь написал `/solve`, поэтому МОЖНО показать полное решение. Приведите его в fenced code block и добавьте одно предложение пояснения над ним."
      : "4. НИКОГДА не показывайте полное решение. Если пользователь не написал в этом сообщении ровно `/solve`, откажитесь фразой: \"Не покажу полное решение — попробуйте сами, а если очень хочется — напишите `/solve`.\"",
    "5. Не пишите и не правьте код учащегося. Только объясняйте.",
    "6. Ответ — не более 200 слов, если пользователь явно не попросит больше.",
    "",
    "ФОРМАТ",
    "- Обычный markdown. Fenced code blocks с указанием языка.",
    "- При цитировании контекста выделяйте название узла-источника курсивом.",
    "",
    "КОНТЕКСТ",
    `Текущий узел: "${currentNodeTitle}"`,
    `Предшествующие темы в контексте: ${prereqLine}`,
    "",
    "<context>",
    contextBlock,
    "</context>",
  ].join("\n");
}
