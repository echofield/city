'use client'

import { cn } from '@/lib/utils'
import { forwardRef, type InputHTMLAttributes } from 'react'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = 'text', ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm text-text-secondary tracking-wide uppercase">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary',
            'placeholder:text-text-ghost',
            'focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal-glow',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-200',
            error && 'border-alert focus:border-alert focus:ring-alert-glow',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-xs text-alert">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
