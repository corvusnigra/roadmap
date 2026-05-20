"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { sendTutorMessage } from "@/app/api/tutor/actions";
import type { TutorTurn } from "@/app/api/tutor/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface TutorPanelProps {
  roleSlug: string;
  nodeSlug: string;
  nodeTitle: string;
  /** Pre-loaded chat history from the server. */
  initialHistory: TutorTurn[];
}

export function TutorPanel({
  roleSlug,
  nodeSlug,
  nodeTitle,
  initialHistory,
}: TutorPanelProps) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<TutorTurn[]>(initialHistory);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Keep the latest message in view when new turns arrive.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, open]);

  const submit = (text: string) => {
    if (!text.trim() || pending) return;
    startTransition(async () => {
      try {
        const result = await sendTutorMessage({
          roleSlug,
          nodeSlug,
          content: text.trim(),
        });
        setHistory((prev) => [...prev, result.user, result.assistant]);
        setDraft("");
        if (result.stubbed) {
          toast.info("Tutor running in stub mode", {
            description:
              "Set a real ANTHROPIC_API_KEY in .env.local for live answers.",
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Tutor request failed.";
        toast.error("Tutor failed", { description: message });
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="open-tutor"
      >
        <Sparkles className="mr-1 h-3.5 w-3.5" />
        Ask tutor
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-sm"
          role="dialog"
          aria-label={`Tutor for ${nodeTitle}`}
          data-testid="tutor-panel"
          onClick={(e) => {
            // Close when clicking the backdrop, not the inner panel.
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <aside className="flex h-full w-full max-w-md flex-col border-l bg-background shadow-xl">
            <header className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                <h2 className="text-sm font-semibold">
                  Tutor — <span className="text-muted-foreground">{nodeTitle}</span>
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
                aria-label="Close tutor"
                data-testid="close-tutor"
              >
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
              data-testid="tutor-messages"
            >
              {history.length === 0 ? (
                <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p>
                    Ask anything about <em>{nodeTitle}</em> or its prerequisites.
                    Examples:
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    <li>“Why prefer <code>&lt;article&gt;</code> over <code>&lt;div&gt;</code>?”</li>
                    <li>“I&apos;m stuck on the refactor — what should I look at first?”</li>
                    <li>
                      Type <code>/solve</code> to ask the tutor to reveal the
                      full code solution.
                    </li>
                  </ul>
                </div>
              ) : null}

              {history.map((turn) => (
                <MessageBubble key={turn.id} turn={turn} />
              ))}

              {pending ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  Thinking…
                </div>
              ) : null}
            </div>

            <form
              className="border-t p-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit(draft);
              }}
            >
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit(draft);
                    }
                  }}
                  rows={2}
                  placeholder="Ask a question…  (Shift+Enter for newline)"
                  className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  disabled={pending}
                  data-testid="tutor-input"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!draft.trim() || pending}
                  data-testid="tutor-send"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                The tutor only uses material from <em>{nodeTitle}</em> and its
                prerequisites.
              </p>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function MessageBubble({ turn }: { turn: TutorTurn }) {
  const isUser = turn.role === "user";
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        isUser
          ? "ml-6 bg-primary/5 border-primary/20"
          : "mr-6 bg-card border-border",
      )}
      data-testid={`tutor-message-${turn.role}`}
    >
      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Badge variant={isUser ? "secondary" : "muted"} className="px-1.5 py-0">
          {isUser ? "You" : "Tutor"}
        </Badge>
        <span>{new Date(turn.createdAt).toLocaleTimeString()}</span>
      </div>
      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-2 prose-pre:my-2 prose-pre:bg-muted prose-code:before:content-none prose-code:after:content-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
      </div>
    </div>
  );
}
