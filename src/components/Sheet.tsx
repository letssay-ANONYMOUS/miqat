import { useEffect, useRef, type ReactNode } from 'react';
import { useRubberBand } from '../lib/feel';
import { useI18n } from '../lib/i18n';

interface SheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Sheet({ open, title, subtitle, onClose, children }: SheetProps) {
  const { text } = useI18n();
  const body = useRef<HTMLDivElement>(null);
  useRubberBand(body, 'self');
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label={text('Close', 'إغلاق')}
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card rise relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl sm:rounded-3xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--card-line)] px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-[var(--ink-dim)]">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="-me-1.5 -mt-1 rounded-full p-2 text-[var(--ink-dim)] transition hover:bg-white/10 hover:text-[var(--ink)]"
            aria-label={text('Close', 'إغلاق')}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>
        <div ref={body} className="overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium text-[var(--ink-dim)]">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-[var(--ink-faint)]">{hint}</span>}
    </label>
  );
}

export const selectClass =
  'mt-2 w-full appearance-none rounded-xl border border-[var(--card-line)] bg-black/25 px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent-soft)]';
