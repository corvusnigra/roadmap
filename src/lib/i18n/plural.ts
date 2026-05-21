/**
 * Russian plural form picker. Returns the right grammatical form for `n`.
 *
 * Russian has three plural categories:
 *  - `one`  — 1, 21, 31, … (mod10 === 1 and mod100 !== 11)
 *  - `few`  — 2–4, 22–24, 32–34, … (mod10 ∈ 2..4 and mod100 ∉ 12..14)
 *  - `many` — everything else, including 0
 *
 * Example: pluralRu(n, ["карточка", "карточки", "карточек"])
 */
export function pluralRu(
  n: number,
  [one, few, many]: [string, string, string],
): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
