import type { ReactNode } from 'react';

export interface FieldProps {
  children: ReactNode;
  hint?: string;
  id: string;
  label: string;
}

export function Field({ children, hint, id, label }: FieldProps) {
  const hintId = `${id}-hint`;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
