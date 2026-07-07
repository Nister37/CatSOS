import { useId, useState, type ReactNode } from 'react';

type AccordionSectionProps = {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
  headingLevel?: 2 | 3;
};

export function AccordionSection({
  title,
  count,
  defaultOpen = true,
  summary,
  children,
  className = '',
  headingLevel = 2,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const Heading = `h${headingLevel}` as const;

  return (
    <section className={`bg-white rounded-2xl border border-surface-container-highest shadow-sm overflow-hidden ${className}`}>
      <Heading>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="w-full flex items-center justify-between gap-md p-md md:p-lg text-left hover:bg-surface-container-low transition-colors"
        >
          <span className="min-w-0">
            <span className="flex items-center gap-sm">
              <span className="font-headline-md text-headline-md text-on-surface">{title}</span>
              {typeof count === 'number' && (
                <span className="shrink-0 rounded-full bg-surface-container px-sm py-xs font-label-sm text-label-sm text-secondary">
                  {count}
                </span>
              )}
            </span>
            {summary && (
              <span className="mt-xs block font-body-sm text-body-sm text-secondary">
                {summary}
              </span>
            )}
          </span>
          <span
            className={`material-symbols-outlined text-[22px] text-secondary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            expand_more
          </span>
        </button>
      </Heading>

      <div
        id={panelId}
        hidden={!open}
        className="accordion-panel border-t border-surface-container"
      >
        <div className="p-md md:p-lg">{children}</div>
      </div>
    </section>
  );
}
