import type { ReactNode } from 'react';

export interface PanelProps {
  ariaLabelledBy?: string;
  children: ReactNode;
  className?: string;
  description?: string;
  id: string;
  role?: 'region' | 'tabpanel';
  tabIndex?: number;
  title: string;
}

export function Panel({
  ariaLabelledBy,
  children,
  className = '',
  description,
  id,
  role = 'region',
  tabIndex,
  title,
}: PanelProps) {
  const classes = ['panel', className].filter(Boolean).join(' ');

  return (
    <section
      aria-labelledby={ariaLabelledBy ?? `${id}-title`}
      className={classes}
      id={id}
      role={role}
      tabIndex={tabIndex}
    >
      <header className="panel__header">
        <h2 id={`${id}-title`}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
