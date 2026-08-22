import type { ButtonHTMLAttributes } from 'react';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'regular' | 'small';
}

export function IconButton({
  className = '',
  label,
  size = 'regular',
  type = 'button',
  ...props
}: IconButtonProps) {
  const classes = ['icon-button', `icon-button--${size}`, className].filter(Boolean).join(' ');

  return <button {...props} aria-label={label} className={classes} type={type} />;
}
