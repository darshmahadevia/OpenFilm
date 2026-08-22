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
  disabled,
  displayValue,
  hint,
  id,
  label,
  max,
  min,
  onChange,
  step,
  value,
  ...props
}: SliderProps) {
  const hintId = `${id}-hint`;
  const numericInputId = `${id}-value`;
  const classes = ['slider-field', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div className="slider-field__header">
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
        <div className="slider-field__value-group">
          <output className="slider-field__value" htmlFor={id}>
            {displayValue ?? value}
          </output>
          <input
            aria-describedby={hint ? hintId : undefined}
            aria-label={`${label} value`}
            className="slider-field__number"
            disabled={disabled}
            id={numericInputId}
            inputMode="decimal"
            max={max}
            min={min}
            onChange={onChange}
            step={step}
            type="number"
            value={value}
          />
        </div>
      </div>
      <input
        {...props}
        aria-describedby={hint ? hintId : undefined}
        className="slider"
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onChange={onChange}
        step={step}
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
