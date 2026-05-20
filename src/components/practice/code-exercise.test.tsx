import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

/**
 * jsdom doesn't auto-wrap untrusted `window.message` dispatches in React's
 * act(), so plain dispatchEvent never schedules a re-render. Wrap helper.
 */
async function postSandboxMessage(data: unknown) {
  await act(async () => {
    window.dispatchEvent(new MessageEvent("message", { data }));
  });
}

// --- Mock Sandpack ---------------------------------------------------------
// Sandpack's React internals spin up service workers + iframes that don't
// survive in jsdom. Replace them with minimal stand-ins; the unit under test
// is the postMessage listener + server-action plumbing, not Sandpack itself.
vi.mock("@codesandbox/sandpack-react", () => {
  return {
    SandpackProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="sp-provider">{children}</div>
    ),
    SandpackLayout: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="sp-layout">{children}</div>
    ),
    SandpackCodeEditor: () => <div data-testid="sp-editor" />,
    SandpackPreview: () => <div data-testid="sp-preview" />,
    useSandpack: () => ({ sandpack: { runSandpack: vi.fn(async () => {}) } }),
  };
});

// --- Mock the server action ------------------------------------------------
const recordPracticeCorrect = vi.fn(async () => undefined);
vi.mock("@/app/roles/[slug]/nodes/[nodeSlug]/actions", () => ({
  recordPracticeCorrect: (...args: unknown[]) =>
    recordPracticeCorrect(...(args as [])),
}));

// --- Mock sonner toast (no DOM side effects) -------------------------------
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CodeExercise } from "./code-exercise";

const baseProps = {
  roleSlug: "frontend-developer",
  nodeSlug: "html-semantics",
  itemKey: "code:0",
  index: 0,
  prompt: "Refactor this markup.",
  starterCode: "<div>hi</div>",
  testsCode: "// noop",
  language: "html" as const,
};

describe("<CodeExercise />", () => {
  beforeEach(() => {
    recordPracticeCorrect.mockClear();
  });
  afterEach(() => cleanup());

  it("fires onPass and records progress when the sandbox posts a PASS result", async () => {
    const onPass = vi.fn();
    render(<CodeExercise {...baseProps} onPass={onPass} />);

    await postSandboxMessage({
      source: "rr-exercise",
      kind: "result",
      ok: true,
      message: "All semantic landmarks present",
    });

    await waitFor(() =>
      expect(
        screen.getByTestId(`code-exercise-${baseProps.index}-verdict-pass`),
      ).toBeTruthy(),
    );
    await waitFor(() => expect(recordPracticeCorrect).toHaveBeenCalledTimes(1));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it("shows a fail verdict but does not call onPass on a FAIL result", async () => {
    const onPass = vi.fn();
    render(<CodeExercise {...baseProps} onPass={onPass} />);

    await postSandboxMessage({
      source: "rr-exercise",
      kind: "result",
      ok: false,
      message: "Expected to find element matching article",
    });

    await waitFor(() =>
      expect(
        screen.getByTestId(`code-exercise-${baseProps.index}-verdict-fail`),
      ).toBeTruthy(),
    );
    expect(onPass).not.toHaveBeenCalled();
    expect(recordPracticeCorrect).not.toHaveBeenCalled();
  });

  it("ignores messages whose schema does not match", async () => {
    const onPass = vi.fn();
    render(<CodeExercise {...baseProps} onPass={onPass} />);

    await postSandboxMessage({ source: "evil-extension", kind: "result", ok: true });
    await postSandboxMessage({ source: "rr-exercise" });

    expect(onPass).not.toHaveBeenCalled();
    expect(recordPracticeCorrect).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId(`code-exercise-${baseProps.index}-verdict-pass`),
    ).toBeNull();
    expect(
      screen.queryByTestId(`code-exercise-${baseProps.index}-verdict-fail`),
    ).toBeNull();
  });

  it("only records progress once even if PASS arrives twice", async () => {
    const onPass = vi.fn();
    render(<CodeExercise {...baseProps} onPass={onPass} />);

    const pass = () =>
      postSandboxMessage({ source: "rr-exercise", kind: "result", ok: true });

    await pass();
    await pass();

    await waitFor(() =>
      expect(
        screen.getByTestId(`code-exercise-${baseProps.index}-verdict-pass`),
      ).toBeTruthy(),
    );
    await waitFor(() => expect(recordPracticeCorrect).toHaveBeenCalledTimes(1));
    expect(onPass).toHaveBeenCalledTimes(1);
  });
});
