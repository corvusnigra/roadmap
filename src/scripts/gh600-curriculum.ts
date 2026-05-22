/**
 * Учебный план GH-600 «Разработка в агентических системах ИИ»
 * (Microsoft Certification). Каждый узел отвечает на «зачем»,
 * «какой инструмент / шаблон», «что делать регулярно» с привязкой к
 * маркерам освоения и антипаттернам — фрейм Левенчука D/T/P.
 *
 * Источник:
 *   https://learn.microsoft.com/ru-ru/credentials/certifications/resources/study-guides/gh-600
 * Тексты `what` / `diff` / `tech` / `practice` / `markers` / `anti` —
 * это моя best-effort авторская работа на материале syllabus'а + общей
 * практики agentic LLM systems в SDLC.
 */

import type { LDiscipline } from "./levenchuk-curriculum";

export const GH600_LEVELS: Record<
  number,
  { title: string; meta: string; intro: string }
> = {
  0: {
    title: "Архитектура агента и SDLC (15-20%)",
    meta: "Интеграция в SDLC · Планирование/действие · Наблюдаемость",
    intro:
      "Где агент встаёт в жизненный цикл, как разделить план от исполнения и как сохранить наблюдаемость без замедления доставки.",
  },
  1: {
    title: "Инструменты и среда (20-25%)",
    meta: "Tools · MCP · Среды · Безопасное выполнение",
    intro:
      "Минимально необходимый набор инструментов, MCP-серверы, контекст исполнения и обработка ошибок — поверхности, которые определяют безопасность системы.",
  },
  2: {
    title: "Память, состояние, выполнение (10-15%)",
    meta: "Память · Контекст-дрейф · Непрерывность",
    intro:
      "Какую память даёт агент, как удержать состояние длинной задачи и как избежать дрейфа контекста между шагами и инструментами.",
  },
  3: {
    title: "Оценка, анализ ошибок, настройка (15-20%)",
    meta: "Критерии · Анализ сбоев · Настройка поведения",
    intro:
      "Не «не упал» = успех. Машинно-проверяемые критерии, разбор сбоев по логам/планам и точечная подстройка инструкций и tools.",
  },
  4: {
    title: "Многоагентная координация (15-20%)",
    meta: "Оркестрация · Наблюдаемость · Отказы · Жизненный цикл",
    intro:
      "Несколько агентов = новая поверхность отказов. Шаблоны оркестрации, артефакты для аудита, recovery и подстановка/вывод агентов без даунтайма.",
  },
  5: {
    title: "Ограничители и подотчётность (10-15%)",
    meta: "Уровни автономии · Guardrails и human-in-the-loop",
    intro:
      "Классификация действий по риску, явные ограничители и обязательные точки одобрения для необратимых действий.",
  },
};

export const GH600_DISCIPLINES: LDiscipline[] = [
  // ===== Domain 1: Архитектура агента и SDLC ==============================
  {
    slug: "agent-sdlc-integration",
    title: "Интеграция агентов в SDLC",
    level: 0,
    estimatedMinutes: 30,
    question: "Где агенты встают в жизненный цикл и как определить вход/выход/критерий успеха?",
    what:
      "SDLC — это последовательность шагов с конкретными артефактами (issue → PR → check run → deploy → инцидент). Агент в SDLC встаёт между двумя артефактами: принимает один на вход и обязан произвести другой на выход. То, что не попало в issue/PR/check/workflow run, де-факто не произошло — это нельзя ни отревьюить, ни откатить. GitHub становится системой записей и плоскостью управления для агентов.",
    diff: [
      "Шаг агента = вход → решение → действие → проверка → артефакт",
      "Артефакт = «контракт», не «агент завершился без исключений»",
      "Узкая задача с явным критерием ↔ размытая «помоги с проектом»",
      "Идемпотентность шага = повторный запуск даёт тот же артефакт",
    ],
    tech: [
      "GitHub issue templates с явными полями вход/выход/критерий",
      "PR description template: «что делает / как проверить / откатить»",
      "Check runs как машинно-проверяемые сигналы успеха",
      "GitHub Actions workflow_run как сцена для агента",
    ],
    practice: [
      "Формулируй задачу для агента как 4 блока: вход / выход / ограничения / критерий успеха",
      "Каждое действие агента → видимый артефакт (PR/issue/check)",
      "Критерий успеха — машинно-проверяемое условие, не «выглядит ок»",
    ],
    markers: [
      "Различаешь «агент закончил» от «задача выполнена»",
      "Можешь восстановить ход работы агента из артефактов GitHub",
      "Знаешь, какие шаги SDLC безопасно делегировать, какие нет",
    ],
    anti: [
      "Boil-the-ocean: один PR на десятки файлов и две задачи",
      "Hidden execution: правки в main без следа в issues/PR",
      "Implicit success: «не упал» считается успехом",
    ],
  },
  {
    slug: "planning-reasoning-action",
    title: "Планирование, обоснование, действие",
    level: 0,
    estimatedMinutes: 30,
    question: "Как разделить фазу планирования от исполнения, чтобы план можно было проверить до действий?",
    what:
      "Если агент сразу действует — ошибки в рассуждении превращаются в коммиты, а откатывать их дороже, чем заранее править план. Дисциплина «план → проверка → действие» делает план отдельным артефактом, который можно прочитать, оспорить и утвердить. Без этого agentic loop работает как чёрный ящик: «вы сами увидите, что получилось».",
    diff: [
      "План (артефакт) ↔ намерение (в голове агента)",
      "Структурированный план (markdown/JSON) ↔ свободный текст",
      "План до действий ↔ план после факта",
      "Утверждение плана человеком ↔ автоматическое execute",
    ],
    tech: [
      "Claude Code plan mode (`/plan`)",
      "GitHub Copilot Workspace — план изменений до апплая",
      "Structured prompt template: «выведи план как нумерованный список с входами/выходами»",
      "Pre-action review: human approval перед exec",
    ],
    practice: [
      "Для нетривиальной задачи запрашивай план до действий",
      "Читай план вслух (или попроси агента пересказать) перед approval",
      "Шаблон плана: цель / шаги / артефакты / точки отката",
    ],
    markers: [
      "Знаешь, на каких задачах включаешь plan-mode",
      "План = первый артефакт ревью, а не пересказ после факта",
      "Останавливаешь агента, если план уходит не туда",
    ],
    anti: [
      "Исполнение без явного плана",
      "План «в голове агента», не на бумаге",
      "Принять план не читая",
    ],
  },
  {
    slug: "autonomous-observability",
    title: "Наблюдаемость автономных агентов",
    level: 0,
    estimatedMinutes: 30,
    question: "Как обеспечить проверяемый след автономного агента, не замедляя доставку?",
    what:
      "Автономия ≠ невидимость. Чем дальше агент от человека, тем важнее, чтобы каждое действие оставляло артефакт в стандартных инструментах разработки (PR, check run, comment). Observability на трёх уровнях: что планировал → что сделал → что получилось. Human-in-the-loop по запросу при высоком риске, не по умолчанию (иначе агент бесполезен).",
    diff: [
      "Артефакты в стандартных tools (GitHub) ↔ кастомные dashboard'ы",
      "Автономия по риску действия ↔ по типу действия",
      "Pull-based наблюдение (когда нужно) ↔ push-based уведомления (всё подряд)",
      "Trace на уровне tool call ↔ только итоговый результат",
    ],
    tech: [
      "GitHub check runs для машинно-читаемых сигналов",
      "Draft PRs для work-in-progress",
      "OpenTelemetry tracing для длинных tool-цепочек",
      "Agent metadata в issue/PR labels",
    ],
    practice: [
      "Каждый шаг агента → видимый артефакт",
      "Eженедельный audit логов: какие действия пропали мимо ревью?",
      "Risk-tier таблица: какие действия требуют approval, какие нет",
    ],
    markers: [
      "Можешь восстановить, что делал агент 2 недели назад, из артефактов",
      "Знаешь, как поднять alert на высокорисковое действие",
      "Команда не жалуется на «слишком много уведомлений от агентов»",
    ],
    anti: [
      "«Просто работает где-то в фоне»",
      "Observability только когда что-то сломалось",
      "Любое действие → email/Slack (alert fatigue)",
    ],
  },
  // ===== Domain 2: Инструменты и среда ====================================
  {
    slug: "agent-tools-selection",
    title: "Инструменты агента",
    level: 1,
    estimatedMinutes: 30,
    question: "Какой минимальный набор инструментов нужен агенту для конкретной задачи?",
    what:
      "Tool selection — это function calling. Каждый tool — поверхность атаки и потенциальный источник ошибок. Принцип минимально необходимой мощности: даём только то, что нужно для задачи. Read больше чем write, локальный > удалённый, обратимый > необратимый. Список tools агента должен помещаться в голове разработчика.",
    diff: [
      "Tool list ↔ permission grant (наличие ≠ разрешение использовать)",
      "Read tools ↔ write tools ↔ exec tools — разные уровни доверия",
      "Локальный (filesystem) ↔ удалённый (web fetch, API call)",
      "Обратимое (edit file) ↔ необратимое (deploy, drop table)",
    ],
    tech: [
      "tool_choice control в Anthropic API",
      "MCP server selection (какие сервера подключены, какие tools от них)",
      "Allow/deny patterns в settings.json (Claude Code permissions)",
      "Tool descriptions, которые модель реально видит",
    ],
    practice: [
      "Для каждого нового агента: какой минимальный набор tools? зачем каждый?",
      "Review tool list при изменении задачи (минимум раз в спринт)",
      "Если tool используется <5% времени — выпиливай или объединяй",
    ],
    markers: [
      "Твои агенты имеют 3-7 tools максимум, не 20",
      "Знаешь, для чего нужен каждый tool",
      "Описание tool помещается в одну фразу",
    ],
    anti: [
      "«Дать все доступные tools на всякий случай»",
      "Tools с пересекающимся scope (агент путается, какой использовать)",
      "Длинные tool descriptions, которые занимают context",
    ],
  },
  {
    slug: "mcp-servers",
    title: "MCP-серверы",
    level: 1,
    estimatedMinutes: 30,
    question: "Как подключить MCP-сервер как инструмент агента и контролировать его поверхность?",
    what:
      "MCP (Model Context Protocol) — открытый стандарт от Anthropic для типизированного обмена между LLM и внешними системами. Сервер описывает свои tools (write actions), resources (read data), prompts (templates); клиент подключается, агент получает доступ. Каждый MCP — отдельный процесс с собственным scope доступа. Три уровня контроля: какие сервера подключены / какие tools от сервера активны / какие конкретные ресурсы.",
    diff: [
      "MCP server = process с протоколом ↔ просто REST API",
      "stdio transport (локальный) ↔ HTTP transport (удалённый)",
      "Resource (read) ↔ tool (write) ↔ prompt (template)",
      "Public MCP registry ↔ private MCP (свой)",
    ],
    tech: [
      "GitHub Remote MCP — официальный сервер GitHub для агентов",
      "settings.json: `mcpServers` блок + per-server allowlists",
      "MCP registries для discovery (public + private)",
      "Allowlist на уровне сервера + на уровне конкретных tools",
    ],
    practice: [
      "Для каждого нового MCP review его tools list ДО подключения",
      "Держи registry MCP-серверов в проекте (как dependencies)",
      "Pin версии серверов; обновляй явно, с changelog ревью",
    ],
    markers: [
      "Знаешь, какие MCP подключены и какие tools они дают",
      "Не подключаешь «удобные» сервера без аудита их tools",
      "Различаешь trusted MCP (свой/official) от untrusted (community)",
    ],
    anti: [
      "«Просто подключить, посмотрим что даст»",
      "Trust незнакомым MCP servers (= permission grant unknown party)",
      "Не вычитывать tools list при первом подключении",
    ],
  },
  {
    slug: "dev-environment-integration",
    title: "Интеграция в среды разработки",
    level: 1,
    estimatedMinutes: 30,
    question: "Как настроить scope агента в твоём dev environment — репо, ветка, env, CI?",
    what:
      "Контекст исполнения — это где агент работает: какой репозиторий, какая ветка, какие env vars, какие команды exec'ит, какая инфра доступна. Узкий scope = меньше surface area, легче ревью, дешёвый откат. Branch-based work = изоляция: если что-то сломалось — просто закрываешь ветку. Trunk-based с агентами = большие риски на молодой системе governance.",
    diff: [
      "Full-repo scope ↔ subdirectory scope ↔ single-file scope",
      "Trunk-based ↔ branch-based work",
      "CI agent (запускается по триггеру) ↔ interactive agent",
      "Ephemeral environment ↔ shared dev env",
    ],
    tech: [
      "GitHub Codespaces config (`.devcontainer/`) для isolated env",
      "`.gitattributes` / `.cursorignore` для скрытия от агента",
      "Branch protection rules + status checks",
      "Workflow_dispatch для CI-based agents",
    ],
    practice: [
      "Один агент = одна задача = одна ветка",
      "Запрет push в protected branches (main, release)",
      "Ephemeral environments для длинных задач (preview deployments)",
    ],
    markers: [
      "Знаешь scope каждого активного агента (репо/ветка/env)",
      "Ноль случаев «случайно тронул не ту ветку»",
      "Восстановление после сбоя = закрытие ветки за 30 секунд",
    ],
    anti: [
      "Full-repo write access без явной причины",
      "Работа агента в main без gate'ов",
      "State, который persist'ится между несвязанными задачами",
    ],
  },
  {
    slug: "safe-execution-error-handling",
    title: "Безопасное выполнение и обработка ошибок",
    level: 1,
    estimatedMinutes: 30,
    question: "Как обработать ошибки tool-вызовов и обеспечить безопасное прерывание long-running agent?",
    what:
      "Tool calls фейлятся по сети, по timeout'у, по правам доступа, по бизнес-логике. Без явной обработки агент входит в retry-loop или галлюцинирует «успех». Дисциплинированный error handling = retry limit + exponential backoff + явный escalation path к человеку. Long-running agent должен уметь сохранять checkpoint и восстанавливаться, а не пере-делать с нуля.",
    diff: [
      "Retry с exponential backoff ↔ tight retry loop",
      "Transient error (сеть) ↔ permanent (нет прав)",
      "Escalation к человеку ↔ continue retry",
      "Rollback (отменить шаги) ↔ partial state (оставить как есть)",
    ],
    tech: [
      "Idempotency keys для tool calls с побочным эффектом",
      "Checkpoint + restore (state в файле перед длинной операцией)",
      "Escalation paths через PR comment + label",
      "Circuit breaker pattern для нестабильных внешних API",
    ],
    practice: [
      "Лимит попыток ≤5 для любого retry",
      "Явный escalation path заранее (не «когда упадёт, тогда разберёмся»)",
      "Failure → observable artifact (PR comment с трассой)",
    ],
    markers: [
      "Ноль агентов «висят» больше 30 минут",
      "Знаешь точку remediation для типичных fails (сеть, права, конфликты)",
      "После сбоя — артефакт с трассой, не «что-то сломалось»",
    ],
    anti: [
      "Бесконечный retry-loop",
      "Молчаливый fail без артефакта",
      "Продолжать после необратимой ошибки",
    ],
  },
  // ===== Domain 3: Память, состояние, выполнение ==========================
  {
    slug: "memory-strategies",
    title: "Стратегии памяти агента",
    level: 2,
    estimatedMinutes: 30,
    question: "Какую память даёт агент, и как ограничить её рамками задачи?",
    what:
      "Память агента — три типа: короткая (context window), длинная (persisted: файлы, БД), внешняя (RAG, semantic search). Каждый тип имеет своё назначение и риски. Без явных правил жизненного цикла память накапливает шум, секреты и устаревшие факты. Дисциплина = явный choice типа памяти для задачи + retention policy + purge schedule.",
    diff: [
      "Short-term (window, до 1M токенов) ↔ long-term (persisted) ↔ external (RAG)",
      "Scope per task ↔ persistent across tasks",
      "Opt-in remember ↔ default-remember (опасно)",
      "Mutable memory (можно перезаписать) ↔ append-only",
    ],
    tech: [
      "Claude prompt caching (5-min TTL, дешёвый long-context)",
      "Memory tool calls (write/read к файлам)",
      "Vector DB для semantic recall",
      "Файловая структура: short-term — `.cache/`, long-term — committed",
    ],
    practice: [
      "Каждая новая задача начинает с чистого state",
      "Явный artifact = что сохраняем между задачами (что-то конкретное)",
      "Periodic purge (раз в спринт): что устарело? что протухло?",
    ],
    markers: [
      "Знаешь, что хранится в long-term memory твоих агентов",
      "Нет «случайной утечки» prior task context",
      "Memory снимаешь как PR-артефакт, а не как side-effect",
    ],
    anti: [
      "«Память по умолчанию накапливается»",
      "Не описана retention policy",
      "Secrets в context window сохраняются в long-term memory",
    ],
  },
  {
    slug: "state-context-drift",
    title: "Состояние и смещение контекста",
    level: 2,
    estimatedMinutes: 30,
    question: "Как держать состояние длинной задачи и обнаружить дрейф контекста?",
    what:
      "Long-running agentic task = накопление промежуточного состояния. Между шагами агент может: забыть инвариант, начать противоречить предыдущему решению, потерять фокус. Это контекст-дрейф. Защита — фиксация ключевых решений в долговременных артефактах (план, decisions log) и периодическая «сверка» с исходной задачей.",
    diff: [
      "Прогресс ↔ дрейф (прогресс приближает к цели, дрейф отдаляет)",
      "Записанные решения (artifacts) ↔ контекст-окно (волатильное)",
      "Resume from checkpoint ↔ restart from scratch",
      "Самопроверка агентом ↔ внешний invariant",
    ],
    tech: [
      "Decisions log (ADR-style) в репо",
      "Plan file, обновляемый между шагами",
      "Sanity check prompts: «вернёмся к исходной задаче — что нужно было сделать?»",
      "Git commits после каждого значимого шага = checkpoint",
    ],
    practice: [
      "Фиксируй ключевые решения как долговременные артефакты (не как chat history)",
      "После 5 шагов — sanity check: «совпадает с целью?»",
      "При резком повороте плана — спроси, почему",
    ],
    markers: [
      "Видишь дрейф в моменте, не через час",
      "Знаешь, как «восстановить» агента из последнего стабильного checkpoint",
      "В долгих сессиях не теряешь нить — отслеживаешь state",
    ],
    anti: [
      "Не фиксировать решения — «потом разберёмся»",
      "Длинные сессии без перерывов на sanity check",
      "Доверять «помнит ли агент» вместо записанного факта",
    ],
  },
  {
    slug: "memory-continuity",
    title: "Непрерывность памяти и состояния",
    level: 2,
    estimatedMinutes: 25,
    question: "Как обеспечить общий state между инструментами и средами без устаревания и конфликтов?",
    what:
      "Когда задача проходит через несколько tools и сред (локальный editor → CI → production), state должен быть source-of-truth и явно передаваться, а не «всплывать» в каждом контексте. Конфликтующий контекст = два tool'а имеют разные snapshots. Устаревший контекст = state из прошлой задачи влияет на текущую.",
    diff: [
      "Shared state (один источник правды) ↔ replicated (копии в разных местах)",
      "Конфликт (два источника не согласны) ↔ устаревание (один отстал)",
      "Версионированный state (commit hash) ↔ free-form",
      "Read-through cache ↔ stale cache",
    ],
    tech: [
      "Git commit как универсальный handle на state",
      "Версионированные artifacts (с commit hash, не «latest»)",
      "Single-source-of-truth для конфигов (один файл, не дубли)",
      "Cache invalidation by version, не by time",
    ],
    practice: [
      "Любое cross-environment действие — с явным state handle (commit / artifact id)",
      "Один файл = один source-of-truth для конфига",
      "Регулярная sweep на «брошенный» state (старые branches, кэши)",
    ],
    markers: [
      "Знаешь, где живёт каждый kind state твоих агентов",
      "Конфликты состояния ловятся до prod, не в prod",
    ],
    anti: [
      "Несколько источников правды для одного факта",
      "Cache без явной инвалидации",
      "State, мигрирующий между средами «как-нибудь»",
    ],
  },
  // ===== Domain 4: Оценка, анализ ошибок, настройка =======================
  {
    slug: "evaluation-criteria",
    title: "Критерии успешности и сигналы оценки",
    level: 3,
    estimatedMinutes: 30,
    question: "Как определить машинно-проверяемые критерии успеха для задач агента?",
    what:
      "«Не упал» = это не успех. Реальный критерий: после действия выполнено наблюдаемое условие. Машинно-проверяемые сигналы — тесты, lint, статусы CI, metric'и. Качественные сигналы — code review человеком, soak time в проде. Без явного критерия каждая задача завершается «выглядит ок», и качество медленно деградирует.",
    diff: [
      "Машинно-проверяемое ↔ субъективное «выглядит ок»",
      "Критерий per-task ↔ глобальные SLO",
      "Quantitative (% прохождения тестов) ↔ qualitative (review approved)",
      "Built-in (CI runs) ↔ ad-hoc (manual check)",
    ],
    tech: [
      "GitHub check runs как канонические сигналы успеха",
      "Coverage thresholds, lint, type checks как gates",
      "PR review требования (минимум N approvals)",
      "Auto-scanners (CodeQL, Dependabot) как continuous signals",
    ],
    practice: [
      "Для каждой задачи — явный критерий до запуска агента",
      "Критерий формулируется в проверяемом виде («test X зелёный», не «работает»)",
      "Согласуй критерий с целью разработки, не с симптомом",
    ],
    markers: [
      "Можешь сформулировать критерий успеха за 30 секунд",
      "Твои PR имеют явные acceptance criteria в description",
      "Не закрываешь задачу, не проверив каждый критерий",
    ],
    anti: [
      "«Работает» как критерий",
      "Implicit critera, известные только тебе",
      "Closing задачу до зелёного CI",
    ],
  },
  {
    slug: "failure-analysis",
    title: "Анализ сбоев агента",
    level: 3,
    estimatedMinutes: 30,
    question: "Как разбирать сбои агента, отличая ошибки рассуждения от инфра-проблем?",
    what:
      "Сбой агента — это не «AI плохой». Это сигнал, который надо классифицировать. Три класса первопричин: (1) reasoning — ошибка в плане, неверная гипотеза; (2) tool misuse — неправильный вызов, неверные аргументы; (3) context/environment — нет нужного контекста, недоступен ресурс. Без классификации каждый сбой обрабатывается одинаково (обычно — игнорируется или закрывается «сам разберётся»).",
    diff: [
      "Reasoning error (план был не тот) ↔ tool misuse (вызов не тот) ↔ environment (внешний фактор)",
      "Trace через логи tool calls ↔ догадка по симптому",
      "Root cause ↔ proximate cause",
      "Recurring failure ↔ one-off",
    ],
    tech: [
      "Trace logs для tool calls с timestamps + args",
      "Plan diff (что планировал → что сделал)",
      "Failure labels на issues для классификации",
      "Workflow run artifacts (что осталось после fail)",
    ],
    practice: [
      "Каждый sbой — classification: reasoning / tool / environment",
      "Recurring failure → исправление на уровне инструкций или tool description",
      "Weekly review failed runs за прошлую неделю",
    ],
    markers: [
      "За 15 минут можешь сказать, к какому классу относится сбой",
      "Знаешь типичные failure modes твоих агентов",
      "Снижение recurring failures от спринта к спринту",
    ],
    anti: [
      "«AI просто иногда тупит» как объяснение",
      "Не классифицировать failures",
      "Чинить симптом (retry) вместо root cause",
    ],
  },
  {
    slug: "behavior-tuning",
    title: "Настройка поведения агента",
    level: 3,
    estimatedMinutes: 25,
    question: "Как точечно подкручивать поведение агента — инструкции, память, доступ к tools?",
    what:
      "Если агент систематически делает X плохо — это сигнал для tuning. Не «AI плохой», а «инструкции/tools/память не настроены под эту задачу». Подстройка имеет три уровня: (1) prompt / system instructions; (2) tools (добавить/убрать/переписать description); (3) memory (что помнить, что забывать). Изменения внедряются как PR в конфигурацию агента, ревьюются как код.",
    diff: [
      "Tuning на уровне инструкций ↔ tools ↔ memory",
      "Принципиальное изменение (новое поведение) ↔ patch (минор-фикс)",
      "Per-task instructions ↔ глобальные (CLAUDE.md)",
      "Эксперимент (A/B на маленькой выборке) ↔ rollout",
    ],
    tech: [
      "CLAUDE.md / system prompt — версионируется в git",
      "Tool description editing — review как код",
      "Iteration log: что изменили, почему, какой результат",
    ],
    practice: [
      "Изменение поведения = PR с обоснованием",
      "Перед широким rollout — пилот на одной задаче",
      "Откат изменения = revert PR, не «правка вручную»",
    ],
    markers: [
      "Знаешь историю своих агент-конфигов (через git log)",
      "Видишь связь tuning → результат через выборку задач",
    ],
    anti: [
      "Tuning ad-hoc «правя на лету»",
      "Не фиксировать, какое изменение дало эффект",
      "Большие изменения без эксперимента",
    ],
  },
  // ===== Domain 5: Многоагентная координация ==============================
  {
    slug: "multi-agent-orchestration",
    title: "Оркестрация многоагентных систем",
    level: 4,
    estimatedMinutes: 35,
    question: "Как координировать нескольких агентов и разрешать конфликты их выходов?",
    what:
      "Несколько агентов работают над общей задачей — нужна оркестрация. Шаблоны: pipeline (последовательный hand-off), parallel-with-merge (изолированные задачи + объединение), supervisor (один агент даёт задачи другим). Конфликты неизбежны: одинаковые правки в коде, противоречивые выходы. Без явной стратегии разрешения = либо хаос, либо first-write-wins (часто худший выбор).",
    diff: [
      "Pipeline (sequential) ↔ parallel ↔ supervisor (hierarchical)",
      "Изоляция (свой scope) ↔ shared workspace (один репо)",
      "Conflict resolution: merge / vote / supervisor decides",
      "Synchronous (ждём всех) ↔ async (продолжаем без)",
    ],
    tech: [
      "GitHub Actions jobs + dependencies — естественная оркестрация",
      "Multi-agent frameworks (LangGraph, CrewAI)",
      "Custom supervisor agent с explicit handoff'ами",
      "Branch-per-agent + merge через супервизор",
    ],
    practice: [
      "Для каждого multi-agent flow — диаграмма handoff'ов",
      "Изоляция через branches: каждый агент в своей",
      "Conflict resolution стратегия выбирается заранее, не ad-hoc",
    ],
    markers: [
      "Знаешь, какие шаблоны оркестрации работают на каких задачах",
      "Конфликты разрешаются предсказуемо",
    ],
    anti: [
      "First-write-wins без явной политики",
      "Скрытые dependencies между агентами",
      "Один общий workspace без изоляции",
    ],
  },
  {
    slug: "multi-agent-observability",
    title: "Наблюдаемость многоагентных систем",
    level: 4,
    estimatedMinutes: 30,
    question: "Как обеспечить аудит-pригодные артефакты для multi-agent flow?",
    what:
      "В одноагентной системе trace = chain действий одного актора. В multi-agent — это граф: кто кого вызвал, какие данные передали, кто что решил. Без артефактов handoff'а постмортем сводится к гаданию. Главные документируемые объекты: handoff (с input/output), межагентное решение, итоговый результат.",
    diff: [
      "Single-agent trace ↔ multi-agent graph",
      "Handoff артефакт (вход/выход) ↔ implicit handoff",
      "Aggregate result ↔ individual contributions",
      "Real-time monitoring ↔ post-hoc analysis",
    ],
    tech: [
      "Distributed tracing с agent_id в каждом spane",
      "Handoff log в issue/PR comments",
      "Decision records для cross-agent выборов",
      "Multi-agent dashboards (LangSmith, Weights&Biases)",
    ],
    practice: [
      "Каждый handoff → артефакт с {from, to, input, expected_output}",
      "Cross-agent решения документируются в decision log",
      "Post-mortem доступен через артефакты, не нужно реконструировать",
    ],
    markers: [
      "Можешь восстановить multi-agent flow за прошлую неделю по артефактам",
      "Знаешь, какой агент причина конкретного коммита",
    ],
    anti: [
      "Implicit handoffs «он же знает, что делать»",
      "Trace только для одного агента",
      "Не документировать межагентные решения",
    ],
  },
  {
    slug: "multi-agent-failures",
    title: "Отказы в многоагентных системах",
    level: 4,
    estimatedMinutes: 30,
    question: "Как обнаружить и восстановиться после частичного сбоя в multi-agent flow?",
    what:
      "Multi-agent failure modes: (1) один агент завис, остальные ждут; (2) один сделал шаг, другие не получили результат; (3) каскад — fail одного триггерит fail других. Recovery — три уровня: retry конкретного агента, rollback handoff'а, human escalation. Без явной recovery strategy частичный fail оставляет систему в неконсистентном состоянии.",
    diff: [
      "Hard failure (агент упал) ↔ soft (агент дал плохой выход)",
      "Localised (один агент) ↔ cascading (распространяется)",
      "Retry / rollback / escalate — разные стратегии",
      "Eventually consistent ↔ strongly consistent recovery",
    ],
    tech: [
      "Saga pattern для длинных multi-agent flow",
      "Compensating transactions (откатывающие действия)",
      "Watchdog timer на каждого агента",
      "Human-in-the-loop точки при cascade",
    ],
    practice: [
      "Для каждого handoff — определи поведение при failure",
      "Watchdog: если агент молчит >N минут — alert",
      "Cascade failures → автоматическая escalation",
    ],
    markers: [
      "Знаешь recovery path для типичных failures своих flows",
      "Recovery работает без ручного вмешательства в 80% случаев",
    ],
    anti: [
      "Один агент завис, остальные ждут вечно",
      "Cascade без circuit breaker'а",
      "Recovery «вручную каждый раз»",
    ],
  },
  {
    slug: "multi-agent-lifecycle",
    title: "Жизненный цикл многоагентных процессов",
    level: 4,
    estimatedMinutes: 25,
    question: "Как добавлять, обновлять и выводить агентов без нарушения активных flows?",
    what:
      "Production multi-agent система = живая инфра. Агенты добавляются (новая возможность), обновляются (новая модель / новые tools), выводятся (устарели, заменены). Без явной lifecycle-политики каждое изменение = риск сломать активные flows. Дисциплина — versioned agent configs + graceful deprecation + audit trail.",
    diff: [
      "Add (новый агент) ↔ update (изменение существующего) ↔ deprecate (вывод)",
      "Blue-green deployment агента ↔ in-place update",
      "Versioned config ↔ mutable config",
      "Graceful (drain активные tasks) ↔ hard cutoff",
    ],
    tech: [
      "Agent registry с versions",
      "Feature flag для постепенного rollout новых агентов",
      "Deprecation labels + sunset dates",
      "Audit log lifecycle событий",
    ],
    practice: [
      "Новый агент = PR с описанием scope, тестами, rollout планом",
      "Update без backwards-compat = MAJOR version bump",
      "Deprecation = 2-недельный grace period с alert'ами",
    ],
    markers: [
      "Можешь обновить агента без даунтайма flow",
      "Знаешь, какие агенты deprecated и почему",
    ],
    anti: [
      "In-place changes без versioning",
      "Hard cutoff устаревшего агента без grace period",
      "«Просто отключили — потом разберёмся»",
    ],
  },
  // ===== Domain 6: Ограничители и подотчётность ===========================
  {
    slug: "autonomy-levels",
    title: "Уровни автономии",
    level: 5,
    estimatedMinutes: 25,
    question: "Как классифицировать действия по риску и назначить уровни автономии?",
    what:
      "Не все действия равны. Read repo = низкий риск, deploy в prod = высокий. Назначение уровней автономии — это классификация действий по operational риску, security риску и compliance риску, и подбор для каждого: автоматически / approval / запрет. Цель — максимум скорости при сохранении границ. Слишком жёстко — агент бесполезен. Слишком мягко — инциденты.",
    diff: [
      "Operational risk (что сломаем) ↔ security risk (что украдут) ↔ compliance risk (нарушим политики)",
      "Auto-execute ↔ require approval ↔ blocked",
      "Reversible (откатить дёшево) ↔ irreversible",
      "Local impact ↔ broad impact",
    ],
    tech: [
      "Risk-tier таблица: действие × тип риска → уровень автономии",
      "Settings.json allow/ask/deny per command",
      "Branch protection + required reviews для высокорисковых действий",
    ],
    practice: [
      "Для каждого нового tool — risk classification до подключения",
      "Annual review risk-tier таблицы",
      "При инциденте — review, надо ли понижать tier",
    ],
    markers: [
      "У тебя есть документированная risk-tier таблица",
      "Команда понимает, почему какие-то действия требуют approval",
      "Скорость доставки не пострадала от добавления guardrails",
    ],
    anti: [
      "Equal autonomy для всех действий",
      "Не пересматривать tier после инцидента",
      "Approval на тривиальные действия → alert fatigue",
    ],
  },
  {
    slug: "guardrails-human-in-loop",
    title: "Ограничители и human-in-the-loop",
    level: 5,
    estimatedMinutes: 30,
    question: "Как организовать точки одобрения для необратимых действий без потери скорости?",
    what:
      "Guardrails — это запреты + точки обязательного одобрения. Запрет: «не пушить в main», «не call external API без подтверждения». Approval point: «перед deploy в prod покажи план человеку». Принцип минимальных прав: дай столько доступа, сколько нужно для задачи, не больше. Human-in-the-loop НЕ должен замедлять рутинные задачи — он включается только на действиях с высоким impact'ом.",
    diff: [
      "Запрет (hard) ↔ approval gate (soft)",
      "Минимальные права ↔ «удобно — дать всё»",
      "Reversible с откатом ↔ irreversible (всегда нужен approval)",
      "Sync approval (ждём) ↔ async (продолжаем, человек проверит)",
    ],
    tech: [
      "GitHub branch protection + required reviews",
      "Environment protection rules в Actions (manual approval перед deploy)",
      "Settings.json ask permissions для конкретных команд",
      "Pre-commit hooks для запретов локально",
    ],
    practice: [
      "Документируй каждый guardrail (что блокирует, почему)",
      "Approval только для действий с high impact (не для тривиальных)",
      "При альерт fatigue — пересматривай, какие guardrails избыточны",
    ],
    markers: [
      "У тебя есть документированный список guardrails",
      "Нет инцидентов «не туда задеплоили без approval'а»",
      "Команда не жалуется на избыточные approvals",
    ],
    anti: [
      "Approval на всё подряд → alert fatigue → approvals игнорируются",
      "Нет guardrails вообще («доверяем AI»)",
      "Guardrails известны только тебе, не команде",
    ],
  },
];

export function gh600Position(
  level: number,
  indexInLevel: number,
): { x: number; y: number } {
  return { x: level * 360, y: indexInLevel * 130 };
}

export function buildGh600NodeSeeds(): {
  slug: string;
  title: string;
  summary: string;
  positionX: number;
  positionY: number;
  estimatedMinutes: number;
  prerequisites: string[];
}[] {
  const byLevel = new Map<number, LDiscipline[]>();
  for (const d of GH600_DISCIPLINES) {
    const bucket = byLevel.get(d.level) ?? [];
    bucket.push(d);
    byLevel.set(d.level, bucket);
  }

  const out: {
    slug: string;
    title: string;
    summary: string;
    positionX: number;
    positionY: number;
    estimatedMinutes: number;
    prerequisites: string[];
  }[] = [];

  let prevLevelLast: string | null = null;
  for (const lvl of [0, 1, 2, 3, 4, 5] as const) {
    const disciplines = byLevel.get(lvl) ?? [];
    let prevInLevel: string | null = prevLevelLast;
    disciplines.forEach((d, idx) => {
      const pos = gh600Position(d.level, idx);
      out.push({
        slug: d.slug,
        title: d.title,
        summary: d.question,
        positionX: pos.x,
        positionY: pos.y,
        estimatedMinutes: d.estimatedMinutes,
        prerequisites: prevInLevel ? [prevInLevel] : [],
      });
      prevInLevel = d.slug;
    });
    const last = disciplines[disciplines.length - 1];
    if (last) prevLevelLast = last.slug;
  }

  return out;
}
