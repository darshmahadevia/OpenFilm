import type { ReactNode } from 'react';

export interface PanelProps {
  children: ReactNode;
  className?: string;
  description?: string;
  id: string;
  title: string;
}

export function Panel({ children, className = '', description, id, title }: PanelProps) {
  const classes = ['panel', className].filter(Boolean).join(' ');

  return (
    <section aria-labelledby={`${id}-title`} className={classes} id={id}>
      <header className="panel__header">
        <h2 id={`${id}-title`}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
