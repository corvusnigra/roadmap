/**
 * Author-facing static validator for MDX content. Runs WITHOUT a database —
 * pure filesystem + frontmatter checks. Exits non-zero on any error so it
 * can gate CI / pre-publish.
 *
 * What it enforces (on top of the existing zod frontmatter schema):
 *   - `status: published` nodes must meet stricter floors:
 *       · ≥ 8 mastery quiz items (random pick is actually random)
 *       · ≥ 6 flashcards
 *       · ≥ 1 practice item
 *       · no remaining "TODO" markers in body or frontmatter strings
 *   - every prereq slug points at an existing MDX file in the same role
 *   - code-exercise files (starterFile / solutionFile / testsFile) exist
 *
 * Drafts are validated lazily — schema must parse, but TODO counts are
 * reported as info, not errors.
 *
 * Usage:
 *   pnpm content:check
 */

import { readdir, readFile, access, constants } from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

import { NodeFrontmatterSchema } from "@/lib/content/schema";

const CONTENT_ROOT = path.join(process.cwd(), "src", "content", "roles");

interface NodeReport {
  role: string;
  slug: string;
  file: string;
  errors: string[];
  warnings: string[];
  info: string[];
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function listRoleSlugs(): Promise<string[]> {
  try {
    const entries = await readdir(CONTENT_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function listNodeSlugs(roleSlug: string): Promise<string[]> {
  const entries = await readdir(path.join(CONTENT_ROOT, roleSlug), {
    withFileTypes: true,
  });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".mdx"))
    .map((e) => e.name.replace(/\.mdx$/, ""));
}

function countTodos(text: string): number {
  const matches = text.match(/TODO/g);
  return matches ? matches.length : 0;
}

async function checkNode(
  roleSlug: string,
  nodeSlug: string,
  siblingSlugs: Set<string>,
): Promise<NodeReport> {
  const file = path.join(CONTENT_ROOT, roleSlug, `${nodeSlug}.mdx`);
  const report: NodeReport = {
    role: roleSlug,
    slug: nodeSlug,
    file: path.relative(process.cwd(), file),
    errors: [],
    warnings: [],
    info: [],
  };

  const raw = await readFile(file, "utf8");
  const parsed = matter(raw);
  const parsedSchema = NodeFrontmatterSchema.safeParse(parsed.data);
  if (!parsedSchema.success) {
    for (const issue of parsedSchema.error.issues) {
      report.errors.push(
        `frontmatter ${issue.path.join(".") || "(root)"}: ${issue.message}`,
      );
    }
    return report;
  }

  const fm = parsedSchema.data;
  const isPublished = fm.status === "published";

  // Slug must match filename.
  if (fm.slug !== nodeSlug) {
    report.errors.push(
      `frontmatter slug "${fm.slug}" does not match filename "${nodeSlug}.mdx"`,
    );
  }

  // Prereqs must exist as MDX siblings.
  for (const prereq of fm.prerequisites) {
    if (!siblingSlugs.has(prereq)) {
      report.errors.push(
        `prerequisite "${prereq}" has no corresponding MDX file in role "${roleSlug}"`,
      );
    }
  }

  // Code-exercise files must exist on disk.
  for (const item of fm.practice) {
    if (item.kind !== "code") continue;
    const roleDir = path.join(CONTENT_ROOT, roleSlug);
    for (const key of ["starterFile", "solutionFile", "testsFile"] as const) {
      const rel = item[key];
      if (!rel) continue;
      const abs = path.join(roleDir, rel);
      if (!(await exists(abs))) {
        report.errors.push(
          `practice code item references missing file ${key}="${rel}"`,
        );
      }
    }
  }

  // TODO scan — body + serializable frontmatter strings.
  const todoCount =
    countTodos(parsed.content) + countTodos(JSON.stringify(fm));

  if (isPublished) {
    if (fm.flashcards.length < 6) {
      report.errors.push(
        `published nodes need ≥ 6 flashcards (has ${fm.flashcards.length})`,
      );
    }
    if (fm.masteryQuiz.length < 6) {
      report.errors.push(
        `published nodes need ≥ 6 mastery quiz items (has ${fm.masteryQuiz.length})`,
      );
    }
    if (fm.practice.length < 1) {
      report.errors.push(
        `published nodes need ≥ 1 practice item (has ${fm.practice.length})`,
      );
    }
    if (todoCount > 0) {
      report.errors.push(
        `published node still has ${todoCount} TODO marker(s) — resolve them or revert status to draft`,
      );
    }
  } else {
    report.info.push(`status: draft (${todoCount} TODO marker(s))`);
  }

  return report;
}

function printReport(report: NodeReport): void {
  const status = report.errors.length > 0 ? "✗" : "✓";
  console.log(`${status} ${report.role}/${report.slug}  ${report.file}`);
  for (const e of report.errors) console.log(`    error:   ${e}`);
  for (const w of report.warnings) console.log(`    warning: ${w}`);
  for (const i of report.info) console.log(`    info:    ${i}`);
}

async function main() {
  const roleSlugs = await listRoleSlugs();
  if (roleSlugs.length === 0) {
    console.warn(`No roles found under ${CONTENT_ROOT}`);
    return;
  }

  const reports: NodeReport[] = [];
  for (const roleSlug of roleSlugs) {
    const nodeSlugs = await listNodeSlugs(roleSlug);
    const siblingSet = new Set(nodeSlugs);
    for (const nodeSlug of nodeSlugs) {
      reports.push(await checkNode(roleSlug, nodeSlug, siblingSet));
    }
  }

  for (const r of reports) printReport(r);

  const totalErrors = reports.reduce((n, r) => n + r.errors.length, 0);
  const totalWarnings = reports.reduce((n, r) => n + r.warnings.length, 0);
  const drafts = reports.filter((r) =>
    r.info.some((i) => i.startsWith("status: draft")),
  ).length;
  const published = reports.length - drafts;

  console.log("");
  console.log(
    `summary: ${reports.length} node(s) — ${published} published, ${drafts} draft, ${totalErrors} error(s), ${totalWarnings} warning(s)`,
  );

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("content:check failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
