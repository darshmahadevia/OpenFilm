import type { InputHTMLAttributes, ReactNode } from 'react';

export interface SliderProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'aria-label' | 'type' | 'value'
> {
  displayValue?: ReactNode;
  hint?: string;
  id: string;
  label: string;
  value: number;
}

export function Slider({
  className = '',
  displayValue,
  hint,
  id,
  label,
  value,
  ...props
}: SliderProps) {
  const hintId = `${id}-hint`;
  const classes = ['slider-field', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="slider-field__header">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <output className="slider-field__value" htmlFor={id}>
          {displayValue ?? value}
        </output>
      </div>
      <input
        {...props}
        aria-describedby={hint ? hintId : undefined}
        className="slider"
        id={id}
        type="range"
        value={value}
      />
      {hint ? (
        <span className="field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
