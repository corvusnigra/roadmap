import { z } from "zod";

/**
 * Файл `_role.json` рядом с MDX-узлами роли — определяет публичные
 * метаданные роли. Когда этот файл присутствует, `pnpm content:sync`
 * upsert'ит роль + узлы + рёбра + флэшкарты из MDX напрямую — без
 * `<role>-curriculum.ts` и `<role>-scaffold.ts`. См. docs/ADDING_A_ROLE.md.
 *
 * Используем JSON (а не YAML) чтобы не тянуть лишний deps — gray-matter
 * для frontmatter работает на YAML, но это уже внутри MDX-файлов.
 *
 * Пример:
 *
 *   src/content/roles/java-middle-interview/_role.json
 *   {
 *     "title": "Java Middle Interview",
 *     "summary": "Подготовка к собесу на Java Middle...",
 *     "status": "published"
 *   }
 */
export const RoleMetaSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  status: z.enum(["draft", "published"]).default("draft"),
});

export type RoleMeta = z.infer<typeof RoleMetaSchema>;
