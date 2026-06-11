import { publicEnv } from "@/lib/env";

/**
 * Глобальный флаг «демо-режим без логина».
 *
 * Управляется переменной окружения NEXT_PUBLIC_DEMO_MODE:
 *  - "on"  → демо-режим активен (гостевой доступ без логина)
 *  - "off" → обычный режим с обязательной аутентификацией (по умолчанию)
 *
 * Когда `true`:
 *  - middleware не редиректит на /login
 *  - dashboard / роль / узел рендерятся как «гость»: дефолтная published-роль,
 *    нулевой прогресс, пустая история наставника, нет per-user данных
 *  - server-actions, требующие user (setActiveRole, markTheoryRead, gradeCard,
 *    sendTutorMessage), либо no-op'ят, либо отдают понятную ошибку
 *
 * Чтобы вернуть auth — выставить NEXT_PUBLIC_DEMO_MODE=off в Vercel/env.local.
 * Никаких других правок кода не нужно: вся логика заглядывает сюда через одно место.
 */
export const DEMO_MODE = publicEnv.NEXT_PUBLIC_DEMO_MODE === "on";
