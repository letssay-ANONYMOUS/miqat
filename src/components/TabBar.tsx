import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { haptic } from '../lib/feel';

export type Page = 'times' | 'qibla' | 'quran' | 'month' | 'settings';

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
    id: 'quran',
    label: 'Qur’an',
    icon: (
      <>
        <path
          d="M4.4 5.2h11.2a2 2 0 012 2v10.2H6.4a2 2 0 01-2-2V5.2z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M6.8 5.2v12.2M4.4 16.4h13.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
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
 * Bottom dock. On Times it folds to one button; tap the pill to open it.
 *
 * Width is a clip, not a squash — the inner row stays full-size. A dedicated
 * overlay sits on the folded pill so the tap cannot miss (Safari drops hits on
 * 3D-transformed overflow, which is why the last version would not reopen).
 */
export function TabBar({ page, onChange }: { page: Page; onChange: (page: Page) => void }) {
  const rail = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<Page, HTMLButtonElement>());
  const [lens, setLens] = useState<{ left: number; width: number } | null>(null);
  const [openW, setOpenW] = useState(0);
  const [innerW, setInnerW] = useState(0);
  const [shutW, setShutW] = useState(0);
  const [collapsed, setCollapsed] = useState(page === 'times');

  useEffect(() => {
    if (page !== 'times') setCollapsed(false);
  }, [page]);

  useLayoutEffect(() => {
    const railEl = rail.current;
    const barEl = bar.current;
    if (!railEl || !barEl) return;
    const measure = () => {
      const open = railEl.clientWidth;
      if (open <= 0) return;
      const pad =
        parseFloat(getComputedStyle(barEl).paddingLeft) +
        parseFloat(getComputedStyle(barEl).paddingRight);
      const inner = Math.max(0, open - pad);
      setOpenW(open);
      setInnerW(inner);
      setShutW(pad + inner / TABS.length);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(railEl);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const active = items.current.get(page);
    if (active) setLens({ left: active.offsetLeft, width: active.offsetWidth });
  }, [page, innerW, collapsed]);

  const expand = () => {
    haptic('soft');
    setCollapsed(false);
  };

  const select = (id: Page) => {
    if (collapsed) {
      expand();
      return;
    }
    haptic('tick');
    if (id === 'times' && page === 'times') {
      setCollapsed(true);
      return;
    }
    onChange(id);
  };

  const width = collapsed ? shutW || undefined : openW || undefined;

  return (
    <nav className="tabbar-dock">
      <div ref={rail} className="tabbar-rail">
        <div
          ref={bar}
          className={`tabbar${collapsed ? ' is-collapsed' : ''}`}
          role="tablist"
          aria-label="Pages"
          style={
            width
              ? ({
                  width,
                  maxWidth: width,
                  '--tabbar-inner': innerW ? `${innerW}px` : '100%',
                } as CSSProperties)
              : undefined
          }
        >
          {collapsed && (
            <button
              type="button"
              className="tabbar-expand"
              aria-label="Open navigation"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                expand();
              }}
            />
          )}
          <div className="tabbar-inner">
            {lens && (
              <span
                aria-hidden="true"
                className="segmented-lens"
                style={{ transform: `translateX(${lens.left}px)`, width: `${lens.width}px` }}
              />
            )}
            {TABS.map((tab, i) => (
              <button
                key={tab.id}
                ref={(node) => {
                  if (node) items.current.set(tab.id, node);
                  else items.current.delete(tab.id);
                }}
                data-tab={tab.id}
                role="tab"
                aria-selected={page === tab.id}
                aria-hidden={collapsed && tab.id !== 'times'}
                tabIndex={collapsed ? -1 : undefined}
                aria-label={
                  tab.id === 'times' && page === 'times' && !collapsed
                    ? 'Collapse navigation'
                    : tab.label
                }
                onClick={() => select(tab.id)}
                className={`tabbar-item ${page === tab.id ? 'text-[var(--ink)]' : 'text-[var(--ink-dim)]'}`}
                style={{ '--i': i } as CSSProperties}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                  {tab.icon}
                </svg>
                <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
