import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'quiet' | 'outline';
export type ButtonSize = 'regular' | 'small';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  className = '',
  size = 'regular',
  type = 'button',
  variant = 'quiet',
  ...props
}: ButtonProps) {
  const classes = ['button', `button--${size}`, `button--${variant}`, className]
    .filter(Boolean)
    .join(' ');

  return <button {...props} className={classes} type={type} />;
}
