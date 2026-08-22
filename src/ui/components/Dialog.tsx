import type { ReactNode } from 'react';

export interface DialogProps {
  actions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title: string;
}

export function Dialog({ actions, children, onClose, open, title }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
      role="presentation"
    >
      <section aria-labelledby="dialog-title" aria-modal="true" className="dialog" role="dialog">
        <div className="dialog__header">
          <h2 id="dialog-title">{title}</h2>
          <button
            aria-label="Close dialog"
            className="dialog__close"
            onClick={onClose}
            type="button"
          >
            <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 18 18" width="18">
              <path
                d="m5 5 8 8M13 5l-8 8"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
        <div className="dialog__body">{children}</div>
        {actions ? <div className="dialog__actions">{actions}</div> : null}
      </section>
    </div>
  );
}
