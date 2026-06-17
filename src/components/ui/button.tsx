import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
}

const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
  default: 'btn btn-primary',
  secondary: 'btn btn-ghost',
  ghost: 'btn btn-ghost',
  destructive: 'btn',
}

const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'btn-sm',
  md: '',
  lg: '',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(variants[variant], sizes[size], className)}
      {...props}
    />
  ),
)
Button.displayName = 'Button'
