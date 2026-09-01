import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { haptic } from '../lib/feel';

export type Page = 'times' | 'qibla' | 'month' | 'settings';

const TABS: { id: Page; label: string; icon: ReactNode }[] = [
  {
    id: 'times',
    label: 'Times',
    icon: (
      <>
        <circle cx="11" cy="11" r="7.4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M11 6.6V11l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    id: 'qibla',
    label: 'Qibla',
    icon: (
      <>
        <circle cx="11" cy="11" r="7.4" stroke="currentColor" strokeWidth="1.6" />
        <path d="M14.2 7.8l-2 4.4-4.4 2 2-4.4z" fill="currentColor" />
      </>
    ),
  },
  {
    id: 'month',
    label: 'Month',
    icon: (
      <>
        <rect x="3.4" y="4.6" width="15.2" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3.4 9h15.2M7.6 2.8v3.4M14.4 2.8v3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="11" cy="11" r="2.9" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M11 3v1.9M11 17.1V19M19 11h-1.9M4.9 11H3M16.7 5.3l-1.4 1.4M6.7 15.3l-1.4 1.4M16.7 16.7l-1.4-1.4M6.7 6.7L5.3 5.3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </>
    ),
  },
];

/**
 * The bottom bar.
 *
 * Two behaviours worth knowing. The lens is a real piece of glass that travels
 * between buttons rather than a highlight that blinks on and off — it refracts
 * what is behind it, catches light along its top edge, and overshoots slightly
 * on arrival, which is what makes a moving object read as physical.
 *
 * And on the Times page the bar has nothing to offer, so it folds down to a
 * single button and gives the sky back. Tapping that button opens it again.
 * The fold is a width transition on the same element, so the glass stretches
 * rather than being swapped for a different shape.
 */
export function TabBar({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<Page, HTMLButtonElement>());
  const [lens, setLens] = useState<{ left: number; width: number } | null>(null);

  /** Collapsed only ever happens on Times; leaving the page always reopens it. */
  const [collapsed, setCollapsed] = useState(page === 'times');

  useEffect(() => {
    if (page !== 'times') setCollapsed(false);
  }, [page]);

  useLayoutEffect(() => {
    const measure = () => {
      const active = items.current.get(page);
      if (active && !collapsed) setLens({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [page, collapsed]);

  const select = (id: Page) => {
    haptic('tick');
    if (id === 'times' && page === 'times') {
      setCollapsed(true);
      return;
    }
    onChange(id);
  };

  if (collapsed) {
    const times = TABS[0];
    return (
      <nav className="tabbar-dock">
        <div className="tabbar is-collapsed" role="tablist" aria-label="Pages">
          <span aria-hidden="true" className="segmented-lens" style={{ left: 5, right: 5, width: 'auto' }} />
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded="false"
            onClick={() => {
              haptic('soft');
              setCollapsed(false);
            }}
            className="tabbar-item text-[var(--ink)]"
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              {times.icon}
            </svg>
            <span className="text-[10px] font-medium tracking-wide">{times.label}</span>
          </button>
        </div>
      </nav>
    );
  }

  return (
    <nav className="tabbar-dock">
      <div ref={container} className="tabbar" role="tablist" aria-label="Pages">
        {lens && (
          <span
            aria-hidden="true"
            className="segmented-lens"
            style={{ transform: `translateX(${lens.left}px)`, width: `${lens.width}px` }}
          />
        )}
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) items.current.set(tab.id, node);
              else items.current.delete(tab.id);
            }}
            role="tab"
            aria-selected={page === tab.id}
            aria-label={tab.id === 'times' && page === 'times' ? 'Collapse navigation' : tab.label}
            onClick={() => select(tab.id)}
            className={`tabbar-item ${page === tab.id ? 'text-[var(--ink)]' : 'text-[var(--ink-dim)]'}`}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              {tab.icon}
            </svg>
            <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
