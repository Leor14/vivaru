"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

const SWIPE_THRESHOLD = 60;

/**
 * Carrusel deslizable para los tableros del módulo Financiero. Cada hijo es un
 * slide (un tablero). Navega por arrastre (pointer), flechas, puntos y teclas
 * ←/→. La transición usa los tokens de motion del design system (--ease-out) y
 * respeta prefers-reduced-motion. Todos los slides se montan (no display:none),
 * así sus datos cargan; solo se traslada el riel. Ver globals.css (motion).
 */
export function TableroCarousel({
  children,
  ariaLabel = "Tableros financieros",
}: {
  children: ReactNode;
  ariaLabel?: string;
}) {
  const slides = Children.toArray(children);
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const startX = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const go = (target: number) => setIndex(Math.max(0, Math.min(count - 1, target)));

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    startX.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (dragging) setDrag(e.clientX - startX.current);
  }
  function endDrag() {
    if (!dragging) return;
    if (drag <= -SWIPE_THRESHOLD) go(index + 1);
    else if (drag >= SWIPE_THRESHOLD) go(index - 1);
    setDrag(0);
    setDragging(false);
  }
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") go(index - 1);
    if (e.key === "ArrowRight") go(index + 1);
  }

  if (count === 0) return null;

  return (
    <section role="region" aria-roledescription="carrusel" aria-label={ariaLabel}>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-label="Tablero anterior"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-[var(--slate-200)] bg-white text-[var(--slate-600)] transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <div
          className="min-w-0 flex-1 overflow-hidden"
          style={{ touchAction: "pan-y" }}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div
            className="flex"
            style={{
              transform: `translateX(calc(${-index * 100}% + ${drag}px))`,
              transition: dragging || reduceMotion ? "none" : "transform 300ms var(--ease-out)",
            }}
          >
            {slides.map((slide, i) => (
              <div
                key={i}
                className="min-w-0 shrink-0 grow-0 basis-full px-0.5"
                aria-hidden={i !== index}
              >
                {slide}
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          aria-label="Tablero siguiente"
          onClick={() => go(index + 1)}
          disabled={index === count - 1}
          className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full border border-[var(--slate-200)] bg-white text-[var(--slate-600)] transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Ir al tablero ${i + 1}`}
            aria-current={i === index}
            onClick={() => go(i)}
            className={cn(
              "h-1.5 rounded-full transition-[width,background-color] duration-200",
              i === index ? "w-5 bg-[var(--brand-700)]" : "w-1.5 bg-[var(--slate-300)]",
            )}
          />
        ))}
      </div>
    </section>
  );
}
