import path from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  typedRoutes: true,
  // We live in a git worktree (`/.claude/worktrees/...`) so there's a lockfile
  // both here and in the parent. Pin Next's workspace root to this directory
  // so .env.local is picked up at every build phase (otherwise page-data
  // collection runs from the inferred parent root and misses our env file).
  outputFileTracingRoot: projectRoot,
};

export default withMDX(nextConfig);
