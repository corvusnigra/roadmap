import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("принимает обычный внутренний путь", () => {
    expect(safeRedirectPath("/dashboard")).toBe("/dashboard");
  });

  it("принимает путь с query string", () => {
    expect(safeRedirectPath("/roles/frontend-developer?tab=theory")).toBe(
      "/roles/frontend-developer?tab=theory",
    );
  });

  it("принимает корневой путь /", () => {
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("отклоняет protocol-relative URL //evil.com", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/");
  });

  it("отклоняет //evil.com с fallback", () => {
    expect(safeRedirectPath("//evil.com", "/login")).toBe("/login");
  });

  it("отклоняет Windows-style /\\evil", () => {
    expect(safeRedirectPath("/\\evil")).toBe("/");
  });

  it("отклоняет https:// абсолютный URL", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/");
  });

  it("отклоняет http:// абсолютный URL", () => {
    expect(safeRedirectPath("http://evil.com/phish")).toBe("/");
  });

  it("отклоняет null", () => {
    expect(safeRedirectPath(null)).toBe("/");
  });

  it("отклоняет undefined", () => {
    expect(safeRedirectPath(undefined)).toBe("/");
  });

  it("отклоняет пустую строку", () => {
    expect(safeRedirectPath("")).toBe("/");
  });

  it("использует переданный fallback при отклонении", () => {
    expect(safeRedirectPath("https://phish.io", "/home")).toBe("/home");
  });
});
