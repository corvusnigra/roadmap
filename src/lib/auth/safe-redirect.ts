/**
 * Вспомогательная функция для валидации параметра редиректа.
 *
 * Проблема открытого редиректа: значение "//evil.com" или "/\evil.com"
 * проходит проверку startsWith("/"), но браузер трактует его как
 * протокол-относительный или абсолютный URL, что позволяет перенаправить
 * пользователя на сторонний сайт после авторизации.
 *
 * Правила принятия:
 *  - строка начинается с "/" (это внутренний путь)
 *  - НЕ начинается с "//" (protocol-relative URL → внешний хост)
 *  - НЕ начинается с "/\" (Windows-style path → может трактоваться как //evil.com)
 *
 * @param value — входное значение (может быть null/undefined)
 * @param fallback — значение по умолчанию, если value не прошло валидацию
 * @returns безопасный внутренний путь
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (
    typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.startsWith("/\\")
  ) {
    return value;
  }
  return fallback;
}
