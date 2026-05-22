"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Sparkles, X, Loader2, MessageSquarePlus } from "lucide-react";

import { explainConcept } from "@/app/api/tutor/concept-actions";
import { ASK_TUTOR_EVENT } from "@/components/tutor/tutor-panel";
import { cn } from "@/lib/utils";

interface SelectionTutorProps {
  /** Slug текущей роли — нужен для server-action explainConcept. */
  roleSlug: string;
  /** Slug текущего узла — определяет область RAG'а и кэша. */
  nodeSlug: string;
  /** Theory article subtree. */
  children: ReactNode;
}

interface FloaterPos {
  x: number;
  y: number;
  text: string;
}

interface PopoverState {
  /** Положение поповера (по центру выделения, fixed-координаты). */
  x: number;
  y: number;
  /** Что выделил пользователь. */
  concept: string;
  /** Что показать (markdown). null = идёт запрос. */
  explanation: string | null;
  /** true → из кэша. UX: показываем «мгновенно» бейдж. */
  cached: boolean;
  /** Ошибка от server-action (rate-limit, сеть, что-то ещё). */
  error: string | null;
}

/**
 * Оборачивает контент статьи. Когда пользователь выделяет текст внутри
 * обёртки, рядом появляется плавающая кнопка «Спросить наставника».
 * Клик инициирует server-action `explainConcept`, результат показывается
 * в инлайн-поповере. Повторный клик по тому же выражению в этом же узле
 * мгновенно возвращает кэш — без обращения к LLM.
 *
 * Логика двух уровней:
 *  - quick-explain (поповер) — короткий ответ, общий кэш на узел,
 *    работает в т.ч. для гостей в demo mode.
 *  - «Продолжить в наставнике» (кнопка в поповере) — диспатчит
 *    ASK_TUTOR_EVENT, открывается основная панель с полным диалогом.
 *    Эта вторая дорожка требует авторизации (sendTutorMessage кидает
 *    Not authenticated для гостя — UX-fallback там же).
 */
export function SelectionTutor({
  roleSlug,
  nodeSlug,
  children,
}: SelectionTutorProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [floater, setFloater] = useState<FloaterPos | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  // Guards: чтобы при медленном LLM-ответе и быстром повторном клике
  // не показать «свежий» ответ для старого запроса.
  const requestIdRef = useRef(0);

  useEffect(() => {
    function onSelectionChange() {
      // Если поповер уже открыт — не перехватываем выделение, иначе
      // нажатие на текст внутри поповера сразу перекинет нас обратно
      // на плавающую кнопку.
      if (popover) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setFloater(null);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 2 || text.length > 200) {
        setFloater(null);
        return;
      }
      const wrap = wrapRef.current;
      if (!wrap) return;
      const anchor = sel.anchorNode;
      if (!anchor || !wrap.contains(anchor)) {
        setFloater(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setFloater({
        x: rect.left + rect.width / 2,
        y: rect.top,
        text,
      });
    }

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (target && target.closest("[data-selection-tutor-btn]")) return;
      if (target && target.closest("[data-selection-tutor-popover]")) return;
      setFloater(null);
    }
    function onScroll() {
      setFloater(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setPopover(null);
        setFloater(null);
      }
    }

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [popover]);

  const requestExplanation = useCallback(
    async (text: string, x: number, y: number) => {
      const myId = ++requestIdRef.current;
      setFloater(null);
      // Сразу убираем выделение, чтобы при последующих movement'ах
      // флоатер не воскрес поверх поповера.
      window.getSelection()?.removeAllRanges();
      setPopover({
        x,
        y,
        concept: text,
        explanation: null,
        cached: false,
        error: null,
      });
      try {
        const res = await explainConcept({
          roleSlug,
          nodeSlug,
          concept: text,
        });
        // Если за это время пользователь успел открыть другой — игнор.
        if (requestIdRef.current !== myId) return;
        setPopover({
          x,
          y,
          concept: res.conceptOriginal || text,
          explanation: res.explanation,
          cached: res.cached,
          error: null,
        });
      } catch (err) {
        if (requestIdRef.current !== myId) return;
        setPopover({
          x,
          y,
          concept: text,
          explanation: null,
          cached: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [roleSlug, nodeSlug],
  );

  const continueInTutor = useCallback(() => {
    if (!popover) return;
    window.dispatchEvent(
      new CustomEvent(ASK_TUTOR_EVENT, {
        detail: { prompt: popover.concept },
      }),
    );
    setPopover(null);
  }, [popover]);

  return (
    <div ref={wrapRef} className="relative">
      {children}
      {floater ? (
        <button
          type="button"
          data-selection-tutor-btn
          onClick={() => requestExplanation(floater.text, floater.x, floater.y)}
          className={cn(
            "fixed z-30 -translate-x-1/2 -translate-y-[calc(100%+8px)]",
            "inline-flex items-center gap-1.5 rounded-full bg-prose-accent px-3 py-1.5",
            "text-[12px] font-medium text-white shadow-lg",
            "hover:bg-prose-accent/90 active:scale-[0.98] transition-transform",
            "focus:outline-none focus:ring-2 focus:ring-prose-accent/40",
          )}
          style={{ left: floater.x, top: floater.y }}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Объяснить
        </button>
      ) : null}
      {popover ? (
        <div
          data-selection-tutor-popover
          role="dialog"
          aria-label="Объяснение понятия"
          className={cn(
            "fixed z-40 -translate-x-1/2 translate-y-3",
            "w-[min(420px,calc(100vw-32px))] rounded-lg border border-rule bg-paper shadow-xl",
            "p-4 text-[14px] leading-relaxed text-ink",
          )}
          style={{ left: popover.x, top: popover.y }}
        >
          <div className="flex items-start justify-between gap-2 border-b border-rule pb-2 mb-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-prose-accent">
                {popover.cached ? "Из кэша" : "Наставник"}
              </p>
              <p className="font-serif text-[14px] text-ink truncate mt-0.5">
                «{popover.concept}»
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPopover(null)}
              aria-label="Закрыть"
              className="text-ink-muted hover:text-ink shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {popover.error ? (
            <p className="text-[13px] text-red-600">
              Не получилось объяснить: {popover.error}
            </p>
          ) : popover.explanation === null ? (
            <p className="flex items-center gap-2 text-ink-muted text-[13px]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Думаю…
            </p>
          ) : (
            <div className="whitespace-pre-wrap font-serif text-[14px] text-ink">
              {popover.explanation}
            </div>
          )}
          {popover.explanation && !popover.error ? (
            <div className="mt-3 flex items-center justify-end border-t border-rule pt-2">
              <button
                type="button"
                onClick={continueInTutor}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1",
                  "text-[12px] font-medium text-prose-accent hover:bg-prose-accent/10",
                )}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Продолжить в наставнике
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
