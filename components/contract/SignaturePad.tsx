"use client";

import { cn } from "@/lib/utils";
import { Eraser, Pen, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

const SWATCHES = ["#2fddb0", "#f2f2f5", "#a78bfa", "#e0b567"] as const;

type Tool = "pen" | "eraser";

function fitCanvas(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width === width && canvas.height === height) return;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function point(canvas: HTMLCanvasElement, event: ReactPointerEvent<HTMLCanvasElement>) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

export function SignaturePad({
  disabled,
  resetKey,
  onInkChange,
}: {
  disabled?: boolean;
  resetKey?: number;
  onInkChange?: (hasInk: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const hasInkRef = useRef(false);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<(typeof SWATCHES)[number]>(SWATCHES[0]);
  const [hasInk, setHasInk] = useState(false);

  const markInk = useCallback(
    (next: boolean) => {
      if (hasInkRef.current === next) return;
      hasInkRef.current = next;
      setHasInk(next);
      onInkChange?.(next);
    },
    [onInkChange],
  );

  const wipe = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    markInk(false);
  }, [markInk]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => {
      if (hasInkRef.current) return;
      fitCanvas(canvas);
    });
    observer.observe(canvas);
    fitCanvas(canvas);
    return () => observer.disconnect();
  }, []);

  const skipWipe = useRef(true);
  useEffect(() => {
    if (skipWipe.current) {
      skipWipe.current = false;
      return;
    }
    wipe();
  }, [resetKey, wipe]);

  function stroke(ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = tool === "eraser" ? 16 : 2.4;
    ctx.strokeStyle = color;
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.restore();
  }

  function onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    const at = point(canvas, event);
    lastPoint.current = at;
    stroke(ctx, at, { x: at.x + 0.01, y: at.y });
    if (tool === "pen") markInk(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const at = point(canvas, event);
    const prev = lastPoint.current ?? at;
    stroke(ctx, prev, at);
    lastPoint.current = at;
    if (tool === "pen") markInk(true);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    lastPoint.current = null;
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="label">Signature</p>
        <div className="flex items-center gap-1">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              disabled={disabled}
              aria-label={`Ink ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => {
                setColor(swatch);
                setTool("pen");
              }}
              className={cn(
                "h-4 w-4 rounded-full border border-line-strong",
                color === swatch && tool === "pen" && "ring-2 ring-cyan/70 ring-offset-1 ring-offset-panel",
              )}
              style={{ background: swatch }}
            />
          ))}
        </div>
      </div>
      <div className="flex min-h-[8.5rem] gap-2">
        <div className="relative min-h-[8.5rem] min-w-0 flex-1 overflow-hidden rounded-[var(--radius-md)] border border-line bg-graphite">
          <canvas
            ref={canvasRef}
            className={cn(
              "absolute inset-0 h-full w-full touch-none",
              disabled ? "cursor-not-allowed" : tool === "eraser" ? "cursor-cell" : "cursor-crosshair",
            )}
            aria-label="Contract signature pad"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
          {!hasInk ? (
            <p className="pointer-events-none absolute inset-0 grid place-items-center text-[length:var(--type-micro)] text-mute">
              Sign here
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          <ToolButton
            label="Pen"
            active={tool === "pen"}
            disabled={disabled}
            onClick={() => setTool("pen")}
          >
            <Pen className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton
            label="Eraser"
            active={tool === "eraser"}
            disabled={disabled}
            onClick={() => setTool("eraser")}
          >
            <Eraser className="h-3.5 w-3.5" />
          </ToolButton>
          <ToolButton label="Clear" disabled={disabled || !hasInk} onClick={wipe}>
            <Trash2 className="h-3.5 w-3.5" />
          </ToolButton>
        </div>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] border text-mute",
        "transition-[background-color,border-color,color] duration-[var(--dur-fast)] ease-[var(--ease)]",
        active
          ? "border-cyan/40 bg-cyan/12 text-cyan"
          : "border-line bg-raised hover:border-line-strong hover:text-ink",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </button>
  );
}
