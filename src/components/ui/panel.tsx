'use client'

import { cn } from '@/lib/utils'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { forwardRef } from 'react'

interface PanelProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'raised' | 'glass'
  glow?: 'none' | 'signal' | 'intent' | 'alert'
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ className, variant = 'default', glow = 'none', children, ...props }, ref) => {
    const variants = {
      default: 'bg-surface border-border',
      raised: 'bg-surface-raised border-border',
      glass: 'bg-surface-glass backdrop-blur-xl border-border',
    }

    const glows = {
      none: '',
      signal: 'shadow-[0_0_20px_rgba(0,177,79,0.1)]',
      intent: 'shadow-[0_0_20px_rgba(201,162,74,0.08)]',
      alert: 'shadow-[0_0_20px_rgba(196,92,62,0.08)]',
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'rounded-lg border p-6',
          variants[variant],
          glows[glow],
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
Panel.displayName = 'Panel'
