import type { ReactNode, ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  children?: ReactNode;
}

const variantStyles = {
  primary: 'bg-olive text-paper hover:bg-olive-dark shadow-sm',
  secondary: 'bg-beige-light text-charcoal hover:bg-beige border border-border-light',
  ghost: 'text-muted hover:bg-beige-light hover:text-charcoal',
  danger: 'bg-terracotta/10 text-terracotta hover:bg-terracotta/20',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.5} />}
      {children}
    </button>
  );
}
