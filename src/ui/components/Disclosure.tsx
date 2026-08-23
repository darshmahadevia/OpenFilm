import { useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

export interface DisclosureProps {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  description?: string;
  id: string;
  title: string;
}

export function Disclosure({
  children,
  className = '',
  defaultOpen = false,
  description,
  id,
  title,
}: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const classes = ['disclosure', className].filter(Boolean).join(' ');
  const descriptionId = description ? `${id}-description` : undefined;

  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    setOpen(event.currentTarget.open);
  }

  return (
    <details className={classes} onToggle={handleToggle} open={open}>
      <summary
        aria-controls={`${id}-content`}
        aria-describedby={descriptionId}
        aria-expanded={open}
        aria-label={title}
        className="disclosure__summary"
        role="button"
      >
        <span className="disclosure__copy">
          <span className="disclosure__title">{title}</span>
          {description ? (
            <span className="disclosure__description" id={descriptionId}>
              {description}
            </span>
          ) : null}
        </span>
        <span aria-hidden="true" className="disclosure__indicator" />
      </summary>
      <div className="disclosure__body" id={`${id}-content`}>
        {children}
      </div>
    </details>
  );
}
