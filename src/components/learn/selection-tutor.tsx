"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { ASK_TUTOR_EVENT } from "@/components/tutor/tutor-panel";
import { cn } from "@/lib/utils";

interface SelectionTutorProps {
  /** Theory article subtree. */
  children: ReactNode;
}

interface FloaterPos {
  x: number;
  y: number;
  text: string;
}

/**
 * Оборачивает контент статьи. Когда пользователь выделяет текст внутри
 * обёртки, рядом с выделением появляется плавающая кнопка «Спросить
 * наставника». Клик диспатчит CustomEvent, который TutorPanel ловит —
 * открывается панель с предзаполненным черновиком.
 *
 * Зачем не дёргать TutorPanel напрямую: панель смонтирована в шапке
 * NodeView (выше по дереву), общего ancestor-state нет, а пробрасывать
 * imperative-callback через 3 уровня — лишний coupling. CustomEvent —
 * однонаправленный pub/sub, который тестируем и легко расширять.
 *
 * Ограничения текущей реализации:
 *  - Триггерится только на выделение мышью/touch внутри обёртки. На
 *    клик по одному слову (без drag) не реагирует — это сделано
 *    намеренно, чтобы не мешать прокрутке/копированию.
 *  - Минимальная длина — 2 символа, максимум — 200, чтобы случайные
 *    «нажал и отпустил» не плодили шум, а длинные абзацы не уехали
 *    в текстовый prompt полностью.
 */
export function SelectionTutor({ children }: SelectionTutorProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [floater, setFloater] = useState<FloaterPos | null>(null);

  useEffect(() => {
    function onSelectionChange() {
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
      // Только когда выделение внутри нашей обёртки.
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
        // координаты относительно viewport — кнопка позиционируется fixed
        x: rect.left + rect.width / 2,
        y: rect.top,
        text,
      });
    }

    // Скрыть флоатер при клике где-то ещё или scroll'е — выделение
    // может остаться, но кнопка уже не релевантна.
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Element | null;
      if (target && target.closest("[data-selection-tutor-btn]")) return;
      setFloater(null);
    }
    function onScroll() {
      setFloater(null);
    }

    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const trigger = (text: string) => {
    window.dispatchEvent(
      new CustomEvent(ASK_TUTOR_EVENT, { detail: { prompt: text } }),
    );
    setFloater(null);
    // Снимаем выделение, чтобы при следующем mousedown не открыть тот же
    // флоатер заново.
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div ref={wrapRef} className="relative">
      {children}
      {floater ? (
        <button
          type="button"
          data-selection-tutor-btn
          onClick={() => trigger(floater.text)}
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
          Спросить наставника
        </button>
      ) : null}
    </div>
  );
}
