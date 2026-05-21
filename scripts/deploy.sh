#!/usr/bin/env bash
# Один-кнопочный деплой в Vercel. Прогоняет локальные проверки (typecheck +
# тесты + content:check + build), опционально применяет миграции к prod БД,
# и вызывает `vercel --prod`. Используется вместо GitHub auto-deploy, пока
# не подключён git-провайдер.
#
# Использование:
#   ./scripts/deploy.sh                # полный деплой со всеми проверками
#   ./scripts/deploy.sh --skip-checks  # пропустить локальные test/lint/build
#   ./scripts/deploy.sh --migrate      # доп. прогнать миграции к prod БД
#
# Требования:
#   - vercel CLI (https://vercel.com/cli), залогинен через `vercel login`
#   - pnpm
#   - для --migrate: env var PROD_DATABASE_URL с pooled connection string
#
# Подсказка: если получаешь "Node.js v10.5.0 is not supported", выстави PATH
# к нормальному Node перед запуском:
#   PATH=/Users/moi/.nvm/versions/node/v24.15.0/bin:$PATH ./scripts/deploy.sh

set -euo pipefail

SKIP_CHECKS=0
RUN_MIGRATE=0

for arg in "$@"; do
  case "$arg" in
    --skip-checks) SKIP_CHECKS=1 ;;
    --migrate)     RUN_MIGRATE=1 ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \?//'
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg" >&2
      exit 2
      ;;
  esac
done

# ---------- цвет ----------
if [[ -t 1 ]]; then
  C_INFO=$'\033[1;36m'; C_OK=$'\033[1;32m'; C_WARN=$'\033[1;33m'
  C_ERR=$'\033[1;31m';  C_DIM=$'\033[2m';   C_RST=$'\033[0m'
else
  C_INFO=; C_OK=; C_WARN=; C_ERR=; C_DIM=; C_RST=
fi
say() { printf "%s▸ %s%s\n" "$C_INFO" "$*" "$C_RST"; }
ok()  { printf "%s✓ %s%s\n" "$C_OK"   "$*" "$C_RST"; }
warn(){ printf "%s! %s%s\n" "$C_WARN" "$*" "$C_RST"; }
die() { printf "%s✗ %s%s\n" "$C_ERR"  "$*" "$C_RST" >&2; exit 1; }

# ---------- pre-flight ----------
say "pre-flight"
command -v vercel >/dev/null 2>&1 || die "vercel CLI не установлен. npm i -g vercel"
command -v pnpm >/dev/null 2>&1 || die "pnpm не установлен. corepack enable && corepack prepare pnpm@10 --activate"

if [[ ! -f ".vercel/project.json" ]]; then
  die ".vercel/project.json не найден. Запусти 'vercel link' один раз, чтобы привязать проект."
fi

# Проверка чистого working tree (не блокирующая — только предупреждение)
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  warn "есть незакоммиченные изменения — деплой будет включать их"
fi

CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
ok "branch: $CURRENT_BRANCH"

# ---------- локальные проверки ----------
if [[ $SKIP_CHECKS -eq 0 ]]; then
  say "typecheck"
  pnpm typecheck

  say "lint"
  pnpm lint

  say "unit tests"
  pnpm test

  say "content validator"
  pnpm content:check

  say "production build (локальная sanity-проверка)"
  # Если что-то отвалится здесь — отваливается и на Vercel; ловим до push.
  ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-stub-anthropic-key}" pnpm build > /dev/null
  ok "локальный build прошёл"
else
  warn "локальные проверки пропущены (--skip-checks)"
fi

# ---------- миграции ----------
if [[ $RUN_MIGRATE -eq 1 ]]; then
  if [[ -z "${PROD_DATABASE_URL:-}" ]]; then
    die "--migrate требует env var PROD_DATABASE_URL"
  fi
  say "применение миграций к prod БД"
  DATABASE_URL="$PROD_DATABASE_URL" pnpm db:migrate
  ok "миграции применены"
fi

# ---------- deploy ----------
say "vercel deploy --prod"
DEPLOY_OUTPUT=$(vercel --prod --yes 2>&1) || die "vercel deploy упал:\n$DEPLOY_OUTPUT"

# Vercel CLI печатает URL в последней строке вида "https://...vercel.app"
DEPLOY_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^[:space:]]+\.vercel\.app' | tail -1)

echo
ok "Production deployed"
if [[ -n "$DEPLOY_URL" ]]; then
  printf "%s%s%s\n" "$C_INFO" "$DEPLOY_URL" "$C_RST"
fi
printf "%sDashboard:%s https://vercel.com/dashboard\n" "$C_DIM" "$C_RST"
