'use client'

// ============================================
// HEARTBEAT
// ============================================
// Visual indicator that the system is alive.
// Pulses green when fresh, orange when stale, gray when offline.
// ============================================

import { motion } from 'framer-motion'

interface HeartbeatProps {
  lastUpdate?: Date
  isLive?: boolean
  className?: string
}

type HeartbeatStatus = 'live' | 'stale' | 'offline'

function getStatus(lastUpdate?: Date, isLive?: boolean): HeartbeatStatus {
  if (isLive === false) return 'offline'
  if (!lastUpdate) return 'live' // assume live if no timestamp

  const now = new Date()
  const diff = now.getTime() - lastUpdate.getTime()
  const minutes = diff / 1000 / 60

  if (minutes < 5) return 'live'
  if (minutes < 15) return 'stale'
  return 'offline'
}

const STATUS_COLORS = {
  live: '#0d4a38',    // signal green
  stale: '#5c4d3a',   // intent gold/orange
  offline: '#3a3835', // dim gray
}

const STATUS_GLOW = {
  live: '#1a5c48',
  stale: '#7a6847',
  offline: '#4a4540',
}

export function Heartbeat({ lastUpdate, isLive, className = '' }: HeartbeatProps) {
  const status = getStatus(lastUpdate, isLive)
  const color = STATUS_COLORS[status]
  const glow = STATUS_GLOW[status]

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="relative">
        {/* Glow ring - animated for live/stale */}
        {status !== 'offline' && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: glow }}
            animate={{
              scale: [1, 1.8, 1],
              opacity: [0.4, 0, 0.4],
            }}
            transition={{
              duration: status === 'live' ? 2 : 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
        {/* Core dot */}
        <div
          className="relative w-2 h-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span
        className="text-xs uppercase tracking-wider"
        style={{ color: status === 'offline' ? '#3a3835' : '#5a5550' }}
      >
        {status === 'live' && 'live'}
        {status === 'stale' && 'sync...'}
        {status === 'offline' && 'offline'}
      </span>
    </div>
  )
}
