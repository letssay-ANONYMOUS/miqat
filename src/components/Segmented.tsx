import { useLayoutEffect, useRef } from 'react';
import { useBarGesture } from '../lib/useBarGesture';

export function Segmented<T extends string>({ options, value, onChange, label, size = 'regular', fill = true }: {
  options: { value: T; label: string }[]; value: T; onChange: (value: T) => void;
  label: string; size?: 'regular' | 'compact'; fill?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const gestures = useBarGesture(container, (node) => onChange(node.dataset.value as T));
  useLayoutEffect(() => {
    const bar = container.current;
    if (!bar) return;
    const measure = () => {
      const active = [...bar.querySelectorAll<HTMLElement>('[role="tab"]')].find((node) => node.dataset.value === value);
      const lens = bar.querySelector<HTMLElement>('.segmented-lens');
      if (active && lens) {
        lens.style.transform = `translateX(${active.offsetLeft}px)`;
        lens.style.width = `${active.offsetWidth}px`;
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    bar.querySelectorAll('button').forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [value, options]);
  const pad = size === 'compact' ? 'px-3.5 py-2 text-[13px]' : 'px-5 py-2.5 text-[13px]';
  return <div ref={container} role="tablist" aria-label={label} {...gestures}
    className={`segmented relative inline-flex w-full select-none rounded-full p-1 ${fill ? '' : 'overflow-x-auto'}`}>
    <span aria-hidden="true" className="segmented-lens" />
    {options.map((option) => <button key={option.value} type="button" role="tab" data-value={option.value}
      aria-selected={value === option.value} onClick={() => onChange(option.value)}
      className={`segmented-label ${fill ? 'flex-1' : 'shrink-0'} ${pad} ${value === option.value ? 'text-[var(--ink)]' : 'text-[var(--ink-dim)]'}`}>
      {option.label}
    </button>)}
  </div>;
}
