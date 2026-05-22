/**
 * Глобальный флаг «демо-режим без логина».
 *
 * Когда `true`:
 *  - middleware не редиректит на /login
 *  - dashboard / роль / узел рендерятся как «гость»: дефолтная published-роль,
 *    нулевой прогресс, пустая история наставника, нет per-user данных
 *  - server-actions, требующие user (setActiveRole, markTheoryRead, gradeCard,
 *    sendTutorMessage), либо no-op'ят, либо отдают понятную ошибку
 *
 * Чтобы вернуть auth — поставить `false` и закоммитить. Никаких других правок
 * не нужно: вся логика заглядывает сюда через одно место.
 */
export const DEMO_MODE = true;
