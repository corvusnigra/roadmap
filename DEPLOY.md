# Deployment Guide

Развёртывание RoleRoadmap в продакшен на связке **Vercel + Supabase Cloud +
Resend + Anthropic + PostHog**. Для MVP всё держится в free-tier лимитах.

---

## Шаг 1. Регистрации (10–15 минут)

Открой все ссылки в отдельных вкладках и пройди регистрацию. Везде можно
залогиниться через GitHub — это сокращает время и упрощает дальнейшую
связку учёток.

| Сервис | Ссылка | Зачем |
|---|---|---|
| **GitHub** | <https://github.com/signup> | Хранилище кода + триггер деплоев Vercel |
| **Vercel** | <https://vercel.com/signup> | Хостинг Next.js (выбери Hobby = free) |
| **Supabase** | <https://supabase.com/dashboard/sign-up> | Postgres + Auth + Storage (free 500MB) |
| **Anthropic Console** | <https://console.anthropic.com/> | Ключ для LLM-наставника (pay-as-you-go) |
| **Resend** | <https://resend.com/signup> | SMTP для magic-ссылок (free 3000 писем/мес) |
| **PostHog** | <https://eu.posthog.com/signup> | Аналитика (free 1M событий/мес). Опционально — можно stub. |
| **Stripe** | <https://dashboard.stripe.com/register> | Подписки. Опционально — можно stub до запуска paywall. |

После регистраций код этого репо нужно запушить в новый приватный
GitHub-репозиторий — Vercel будет деплоить именно оттуда.

---

## Шаг 2. Supabase Cloud — создать проект и применить миграции

### 2.1. Создание проекта

1. <https://supabase.com/dashboard/projects> → **New project**.
2. Имя: `roleroadmap-prod`. Регион: ближайший к пользователям (Frankfurt
   `eu-central-1` или Singapore `ap-southeast-1`). Запиши **Database
   password** в менеджер паролей — он понадобится сейчас же и нигде
   больше не показывается.
3. Подожди 2–3 минуты, пока инстанс стартует.

### 2.2. Собрать env vars

В Project → **Settings → API**:

| Переменная | Откуда брать |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | "Project URL" |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | "anon public" key |
| `SUPABASE_SERVICE_ROLE_KEY` | "service_role" key (секретный!) |

В Project → **Settings → Database → Connection string**:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | `Transaction pooler` строка (порт **6543**, не 5432) — критично для serverless |

### 2.3. Прогнать миграции

Локально, **указав prod DATABASE_URL** в одной команде:

```bash
DATABASE_URL='postgresql://postgres.xxx:PASSWORD@aws-...pooler.supabase.com:6543/postgres' \
  pnpm db:migrate
```

Применятся все 7 миграций (0000_init → 0006_active_role_slug_validation).
Проверь в Supabase → **Table Editor**: должны появиться таблицы
`profiles`, `roles`, `nodes`, `node_prerequisites`, `skill_cards`,
`user_node_progress`, `user_card_state`, `user_events`, `tutor_messages`,
`subscriptions`.

### 2.4. Засеять контент

```bash
DATABASE_URL='...' pnpm db:seed
```

В таблице `roles` появятся 3 строки (`frontend-developer`,
`agentic-ai-gh600`, `levenchuk-stack`), в `nodes` — 54 узла.

### 2.5. Auth → Redirect URLs

Project → **Authentication → URL Configuration**:

- **Site URL**: `https://<твой-домен>.vercel.app` (или кастомный домен,
  если уже есть)
- **Redirect URLs**: добавь две строки:
  - `https://<твой-домен>.vercel.app/auth/callback`
  - `https://*.vercel.app/auth/callback` — для preview-деплоев PR'ов

Без этого magic-ссылки будут возвращать ошибку `redirect_to disallowed`.

---

## Шаг 3. Email (Resend) — обязательно для magic-ссылок

Supabase встроенный SMTP даёт 3 письма/час — на проде это слишком мало.

1. Resend → <https://resend.com/api-keys> → **Create API Key**. Запиши.
2. Resend → <https://resend.com/domains> → **Add Domain**. Введи домен
   (например, `roleroadmap.com`). Добавь DNS-записи (SPF + DKIM) у
   твоего регистратора. Подожди ~10 минут до verification.
3. В Supabase → **Authentication → Email Templates → SMTP Settings**:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: ключ из шага 1
   - Sender email: `noreply@yourdomain.com` (на верифицированном домене)

После этого Supabase будет отправлять реальные magic-ссылки через
Resend без жёстких лимитов.

---

## Шаг 4. Anthropic API

1. <https://console.anthropic.com/settings/keys> → **Create Key**.
2. Запиши как `ANTHROPIC_API_KEY`.
3. Установи monthly limit: <https://console.anthropic.com/settings/limits>
   → начни с $20/мес, поднимай по мере роста.

---

## Шаг 5. PostHog и Stripe

`src/lib/env.ts` валидирует все ключи на старте через zod — если хотя
бы одного нет, приложение падает с `Invalid server environment
variables`. Поэтому даже если PostHog/Stripe **не используются на
запуске**, переменные **должны быть заданы** хотя бы как stub'ы.

### 5.1. PostHog (минимум — stub)

Если аналитика не нужна на старте — просто впиши stub-значения:

```
NEXT_PUBLIC_POSTHOG_KEY    = phc_stub
NEXT_PUBLIC_POSTHOG_HOST   = https://eu.i.posthog.com
```

Модуль `src/lib/analytics/posthog.ts` распознаёт `phc_stub` и
no-op'ит вместо реальных вызовов.

Если хочешь реальную аналитику:
1. <https://eu.posthog.com/signup> (или `us.posthog.com`).
2. Project → **Settings → Project API Key** → запиши как
   `NEXT_PUBLIC_POSTHOG_KEY`.
3. Регион определяет `NEXT_PUBLIC_POSTHOG_HOST`:
   `https://eu.i.posthog.com` или `https://us.i.posthog.com`.

### 5.2. Stripe (минимум — stub, если оплата ещё не нужна)

Опять же — zod требует значение. Stub:

```
STRIPE_SECRET_KEY          = sk_test_stub
STRIPE_WEBHOOK_SECRET      = whsec_stub
```

Реальная регистрация когда будешь готов:
1. <https://dashboard.stripe.com/register>.
2. **Test mode** для разработки → Developers → API keys → запиши
   `Secret key` как `STRIPE_SECRET_KEY`.
3. Webhook endpoint: добавь
   `https://<домен>/api/stripe/webhook`, выбери события
   `customer.subscription.*` и `invoice.payment_succeeded` →
   запиши signing secret как `STRIPE_WEBHOOK_SECRET`.

---

## Шаг 6. Vercel — подключить репозиторий

1. <https://vercel.com/new> → **Import Git Repository** → выбери
   только что созданный GitHub-репо.
2. **Framework Preset**: Next.js (автодетект).
3. **Build & Output Settings**:
   - Install Command: `pnpm install`
   - Build Command: `pnpm build` (дефолт)
   - Output Directory: `.next` (дефолт)
4. **Environment Variables** — добавь все собранные в шагах 2–5
   (**все обязательны**, zod-валидация на старте; stub'ы допустимы для
   PostHog и Stripe пока не подключены реальные):

```
DATABASE_URL                       = postgresql://...:6543/postgres
NEXT_PUBLIC_SUPABASE_URL           = https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY      = eyJ...
SUPABASE_SERVICE_ROLE_KEY          = eyJ...
ANTHROPIC_API_KEY                  = sk-ant-...
NEXT_PUBLIC_POSTHOG_KEY            = phc_...    # или phc_stub
NEXT_PUBLIC_POSTHOG_HOST           = https://eu.i.posthog.com
STRIPE_SECRET_KEY                  = sk_live_... # или sk_test_stub
STRIPE_WEBHOOK_SECRET              = whsec_...  # или whsec_stub
```

Применяй для **Production**, **Preview** и **Development** окружений
(одни и те же значения проще всего; для безопасности можно отдельные
preview-ключи).

5. **Deploy**. Первый билд занимает ~2–3 минуты.

---

## Шаг 7. Кастомный домен (опционально)

1. Vercel → Project → **Settings → Domains** → **Add**.
2. Введи `roleroadmap.com`. Vercel покажет DNS-записи: добавь у
   регистратора A-record (или CNAME) и подожди распространения (~10 мин).
3. После активации обнови **Site URL** в Supabase Auth (шаг 2.5).
4. Vercel автоматически выпустит Let's Encrypt SSL-сертификат.

---

## Шаг 8. Проверка

После первого деплоя открой `https://<домен>/login`, введи свой email,
проверь почту — magic-ссылка должна прийти от Resend. Перейди по ней:

- Сразу попадёшь на `/dashboard`.
- Переключи роль в выпадашке → должна работать (`setActiveRole` пишет
  в `profiles.active_role_slug`, trigger 0006 валидирует).
- Открой `/roles/levenchuk-stack` → должно быть 30 узлов, edges
  нарисованы.
- Открой любой узел → теория должна рендериться с serif-типографикой,
  TOC справа на широких экранах.

---

## Подводные камни

| Симптом | Причина | Что делать |
|---|---|---|
| `Tenant or user not found` при подключении к Postgres | DATABASE_URL использует direct connection (5432) | Перейти на pooled (6543) |
| Magic-ссылки не приходят / 3-в-час лимит | Используется встроенный Supabase SMTP | Подключить Resend (шаг 3) |
| `redirect_to disallowed` после клика по magic-ссылке | Redirect URL не в whitelist Supabase | Добавить в Auth → URL Configuration |
| Vercel function timeout 10s на tutor-запросе | Hobby план | Либо Pro ($20/мес, 60s), либо streaming response через SSE |
| `connection limit exceeded` под нагрузкой | Pooled URL имеет лимит ~15 соединений на free | Supabase Pro ($25/мес) даёт 60 |

---

## Затраты при росте

| Объём | Кост |
|---|---|
| < 100 активных юзеров, 1k диалогов с наставником/мес | **$0** (всё в free) + ~$3/мес Anthropic |
| 1k MAU, 10k диалогов | Vercel free + Supabase Pro $25 + Resend $20 + Anthropic ~$30 = **$75/мес** |
| 10k MAU | Vercel Pro $20 + Supabase Pro $25 + Resend $20 + Anthropic ~$300 = **~$365/мес** |

Stripe (если включаем оплату) — 2.9% + $0.30 с транзакции, без месячной
платы.

---

## CI/CD автоматизация

Этот репо содержит два GitHub Action workflow:

- `.github/workflows/ci.yml` — на каждый PR прогоняет
  `pnpm typecheck && pnpm lint && pnpm test`.
- `.github/workflows/migrate-prod.yml` — на push в `main` прогоняет
  `pnpm db:migrate` против prod DATABASE_URL **до** того, как Vercel
  начнёт деплой. Защищает от schema-drift между кодом и БД.

Для последнего нужно добавить в **GitHub repo → Settings → Secrets and
variables → Actions** один secret:

- `PROD_DATABASE_URL` — та же строка, что выложена в Vercel
