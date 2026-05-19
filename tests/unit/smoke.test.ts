import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn (className merger)", () => {
  it("merges tailwind classes and resolves conflicts in favor of the last one", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("filters out falsy values", () => {
    expect(cn("text-sm", false, undefined, "font-medium")).toBe("text-sm font-medium");
  });
});
