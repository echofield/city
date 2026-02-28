'use client'

import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { forwardRef, type SelectHTMLAttributes } from 'react'

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label className="block text-sm text-text-secondary tracking-wide uppercase">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'flex h-10 w-full appearance-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary',
              'focus:outline-none focus:border-signal focus:ring-1 focus:ring-signal-glow',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'transition-colors duration-200',
              error && 'border-alert focus:border-alert focus:ring-alert-glow',
              className
            )}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-ghost pointer-events-none" />
        </div>
        {error && (
          <p className="text-xs text-alert">{error}</p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'
