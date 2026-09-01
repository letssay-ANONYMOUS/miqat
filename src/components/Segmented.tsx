import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
}

/** How close to the edge before the bar starts scrolling itself, in pixels. */
const EDGE = 44;
/** Pixels of travel before a press counts as a drag rather than a tap. */
const SLOP = 3;

/**
 * A glass lens you can tap past or pick up and slide.
 *
 * The lens is the handle: a press only begins a drag if it lands on the lens
 * itself, so pressing a different label is still just a tap. Dragging to either
 * end of a bar that has more options off-screen scrolls it, so a long settings
 * bar can be crossed in one gesture.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'regular',
  fill = true,
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'regular' | 'compact';
  /** Split the width evenly (two options) or let labels size themselves. */
  fill?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<T, HTMLButtonElement>());
  const [lens, setLens] = useState<{ left: number; width: number } | null>(null);
  const [drag, setDrag] = useState<{ left: number; over: T } | null>(null);
  const gesture = useRef<{ id: number; grabDx: number; moved: boolean } | null>(null);
  const autoScroll = useRef<number | null>(null);

  const measure = useCallback(() => {
    const active = buttons.current.get(value);
    if (active) setLens({ left: active.offsetLeft, width: active.offsetWidth });
  }, [value]);

  // Layout effect: measure before paint so the lens never flashes at 0.
  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    buttons.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [measure, options.length]);

  // Fonts land after first paint and change label widths.
  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [measure]);

  useEffect(() => () => stopAutoScroll(), []);

  function stopAutoScroll() {
    if (autoScroll.current !== null) {
      cancelAnimationFrame(autoScroll.current);
      autoScroll.current = null;
    }
  }

  const optionAt = useCallback(
    (left: number, width: number): T => {
      const centre = left + width / 2;
      let closest = options[0].value;
      let best = Infinity;
      for (const option of options) {
        const node = buttons.current.get(option.value);
        if (!node) continue;
        const distance = Math.abs(node.offsetLeft + node.offsetWidth / 2 - centre);
        if (distance < best) {
          best = distance;
          closest = option.value;
        }
      }
      return closest;
    },
    [options],
  );

  const clampToBar = useCallback(
    (raw: number, width: number) => {
      const first = buttons.current.get(options[0].value);
      const last = buttons.current.get(options[options.length - 1].value);
      const min = first?.offsetLeft ?? 0;
      const max = last ? last.offsetLeft + last.offsetWidth - width : min;
      return Math.min(Math.max(min, max) , Math.max(min, raw));
    },
    [options],
  );

  const onPointerDown = (event: React.PointerEvent) => {
    const box = container.current;
    if (!box || !lens) return;
    const x = event.clientX - box.getBoundingClientRect().left + box.scrollLeft;
    // The lens is the handle. A press anywhere else stays a tap.
    if (x < lens.left || x > lens.left + lens.width) return;
    gesture.current = { id: event.pointerId, grabDx: x - lens.left, moved: false };
    box.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const g = gesture.current;
    const box = container.current;
    if (!g || g.id !== event.pointerId || !box || !lens) return;

    const rect = box.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const raw = pointerX + box.scrollLeft - g.grabDx;

    if (!g.moved && Math.abs(raw - lens.left) < SLOP) return;
    g.moved = true;
    event.preventDefault();

    const left = clampToBar(raw, lens.width);
    setDrag({ left, over: optionAt(left, lens.width) });

    // Near an edge with more bar beyond it, scroll while the finger is held.
    const scrollable = box.scrollWidth > box.clientWidth + 1;
    stopAutoScroll();
    if (!scrollable) return;

    const speed =
      pointerX > rect.width - EDGE ? 6 : pointerX < EDGE ? -6 : 0;
    if (speed === 0) return;

    const step = () => {
      const before = box.scrollLeft;
      box.scrollLeft += speed;
      if (box.scrollLeft === before) return; // hit the end
      const next = clampToBar(pointerX + box.scrollLeft - g.grabDx, lens.width);
      setDrag({ left: next, over: optionAt(next, lens.width) });
      autoScroll.current = requestAnimationFrame(step);
    };
    autoScroll.current = requestAnimationFrame(step);
  };

  const endDrag = (event: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    gesture.current = null;
    stopAutoScroll();
    container.current?.releasePointerCapture(event.pointerId);
    if (!drag) return;

    const landed = drag.over;
    /*
     * Clear the drag first so the transition is back on, then let the position
     * update: released mid-slide, the lens glides into its slot instead of
     * snapping there.
     */
    setDrag(null);
    if (landed !== value) onChange(landed);
    else measure();
  };

  const pad = size === 'compact' ? 'px-3.5 py-2 text-[13px]' : 'px-5 py-2.5 text-[13px]';
  const shown = drag ?? (lens ? { left: lens.left, over: value } : null);

  return (
    <div
      ref={container}
      role="tablist"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`segmented relative inline-flex select-none rounded-full p-1 ${
        fill ? 'w-full' : 'w-full overflow-x-auto'
      }`}
    >
      {lens && shown && (
        <span
          aria-hidden="true"
          className={`segmented-lens${drag ? ' is-dragging' : ''}`}
          style={{ transform: `translateX(${shown.left}px)`, width: `${lens.width}px` }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          ref={(node) => {
            if (node) buttons.current.set(option.value, node);
            else buttons.current.delete(option.value);
          }}
          role="tab"
          aria-selected={value === option.value}
          onClick={() => {
            if (!gesture.current?.moved) onChange(option.value);
          }}
          className={`segmented-label ${fill ? 'flex-1' : 'shrink-0'} ${pad} ${
            shown?.over === option.value ? 'text-[var(--ink)]' : 'text-[var(--ink-dim)]'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
