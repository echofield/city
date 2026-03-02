'use client'

import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

interface StatusItem {
  label: string
  value: string
  status?: 'active' | 'warming' | 'inactive'
}

interface StatusBarProps {
  items: StatusItem[]
  className?: string
}

export function StatusBar({ items, className }: StatusBarProps) {
  const statusColors = {
    active: 'text-text-primary',
    warming: 'text-intent',
    inactive: 'text-text-ghost',
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className={cn(
        'flex items-center gap-6 px-6 py-3 bg-surface border border-border rounded-lg',
        className
      )}
    >
      {items.map((item, index) => (
        <div key={item.label} className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-ghost uppercase tracking-wider">
              {item.label}
            </span>
            <span
              className={cn(
                'text-sm font-medium',
                item.status ? statusColors[item.status] : 'text-text-primary'
              )}
            >
              {item.value}
            </span>
          </div>
          {index < items.length - 1 && (
            <span className="text-border">•</span>
          )}
        </div>
      ))}
    </motion.div>
  )
}
