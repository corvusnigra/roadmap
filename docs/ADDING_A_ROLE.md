# Как добавить новую роль (MDX-first)

С новым `pnpm content:sync` любая роль из MDX-файлов попадает на canvas без
правки `seed.ts` или `<role>-curriculum.ts`. Минимальный flow:

## 1. Создать папку под роль

```bash
mkdir -p src/content/roles/my-new-role
```

## 2. Положить `_role.json` рядом с MDX

```json
{
  "title": "Моя новая роль",
  "summary": "Краткое описание — увидит юзер в дашборде и на роадмапе.",
  "status": "draft"
}
```

`status: published` — роль появится в role-switcher на дашборде.
`status: draft` — невидима для юзеров, но в БД есть (для разработки).

## 3. Создать MDX-узлы

Каждый узел = один файл `<slug>.mdx`. Frontmatter (см. полную схему в
`src/lib/content/schema.ts`):

```mdx
---
slug: foo-bar
title: "Foo Bar"
summary: "Что это и зачем."
status: published
level: 1                      # 0..6 — определяет колонку на canvas
estimatedMinutes: 25
prerequisites: ["foo-base"]   # slug'и других узлов в этой же роли
learningOutcomes:
  - "Можешь сказать X"
  - "Применяешь Y"
practice:
  - kind: mcq
    prompt: "Вопрос?"
    options: ["A", "B", "C", "D"]
    answerIndex: 0
    explanation: "Почему A."
flashcards:
  - front: "Q1"
    back: "A1"
  # ≥ 6 карточек для published
masteryQuiz:
  - kind: mcq
    prompt: "..."
    options: ["...", "..."]
    answerIndex: 0
    explanation: "..."
  # ≥ 5 (≥ 8 для published — content:check проверит)
---

## Зачем

Любой текст в Markdown / MDX. Поддерживается:
- GitHub-flavored markdown (таблицы, чекбоксы)
- Кастомные компоненты из `mdxComponents` (Callout и пр.)
- ```code-blocks``` подсветка через rehype-pretty-code
- LaTeX через KaTeX

## Любые свои секции

Хочешь — добавляй любые H2/H3. Они попадают в TOC автоматически (по H2).
```

**Раскладка на canvas** считается автоматически: `level` → колонка X,
порядок MDX-файлов в файловой системе внутри уровня → Y. Хочешь явно
переставить — добавь `level` другим.

## 4. Прогнать sync

### Локально

```bash
pnpm content:check    # проверит схему всех MDX, ≥ 8 masteryQuiz для published, etc.
pnpm content:sync     # upsert роли + узлов + edges + flashcards в local Supabase
```

После — открыть `http://localhost:3000/dashboard?role=my-new-role`.

### На prod

```bash
# 1. Скачать env (содержит SUPABASE_SERVICE_ROLE_KEY)
vercel env pull .env.prod --environment=production --yes

# 2. Sync через PostgREST (обходит pooler timeouts)
pnpm content:sync:prod

# 3. Снести env-файл
rm .env.prod

# 4. Deploy (frontend нужен для MDX-bundle)
vercel --prod --yes
```

## Что НЕ нужно делать

- ❌ Регистрировать роль в `src/db/seed.ts` — sync делает это сам
- ❌ Писать `<role>-curriculum.ts` или `<role>-scaffold.ts` — оба больше не нужны
- ❌ Запускать миграции Drizzle для контента — это только для schema changes

## Когда нужен старый путь

Если ты НЕ кладёшь `_role.json` в папку, sync работает в legacy-режиме:
синхронизирует только flashcards, а роль + узлы должны быть прописаны в
`src/db/seed.ts` (как было раньше). Существующие 5 ролей пока в этом
режиме — это OK, они продолжают работать.

## PDF → MDX (отдельный тикет)

Сейчас MDX пишутся руками. Если хочешь автогенерацию из PDF/конспектов —
смотри `scripts/seed-java-middle-prod.mjs` и обсуждение в issue про
«PDF → MDX pipeline». Пока проще: попросить агента сгенерировать MDX и
положить в папку.
