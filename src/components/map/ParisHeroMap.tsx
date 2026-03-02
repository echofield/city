'use client'

// ============================================
// PARIS HERO MAP
// ============================================
// Simplified Paris map for landing page hero.
// Shows contour, Seine, and 2-3 highlighted zones.
// Minimal animation, maximum recognition.
// ============================================

import { motion } from 'framer-motion'

const MAP_INK = '#3c3f3a'
const SIGNAL_GREEN = '#0d4a38'
const SIGNAL_GLOW = '#1a5c48'
const VOID = '#0a0a0b'

interface ZoneDef {
  id: string
  label: string
  center: [number, number]
}

const HERO_ZONES: ZoneDef[] = [
  { id: 'gare-nord', label: 'Gare du Nord', center: [1100, 280] },
  { id: 'bastille', label: 'Bastille', center: [1200, 900] },
  { id: 'champs', label: 'Champs-Élysées', center: [550, 550] },
]

interface ParisHeroMapProps {
  highlightedZone?: string
  className?: string
}

export function ParisHeroMap({ highlightedZone = 'gare-nord', className = '' }: ParisHeroMapProps) {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 2037.566 1615.5"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: VOID }}
      >
        <defs>
          <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="2037.566" height="1615.5" fill={VOID} />

        {/* Paris Contour - More visible */}
        <g opacity={0.5}>
          <path
            fill="none"
            stroke={MAP_INK}
            strokeWidth="3"
            d="M129.89664,465.39474 L115.79889,484.19173 L120.49814,520.84587 L154.33273,553.7406 L183.46807,557.5 L213.54325,567.83834 L232.34025,561.2594 L251.13724,580.52632 L291.55077,601.67293 L348.8816,633.62782 L415.61092,654.30451 L486.09965,674.04135 L509.59589,688.1391 L551.88912,705.99624 L601.70115,700.35714 L623.31769,687.19925 C623.31769,687.19925 647.75378,693.7782 651.51318,693.7782 C655.27258,693.7782 698.50566,688.1391 698.50566,688.1391 L744.55829,656.18421 L790.61092,630.80827 L831.02446,604.49248 L864.85905,584.75564 L852.641,569.71805 L886.47558,545.28196 L911.85152,552.80075 L925.94927,510.50752 L926.88912,491.71053 L935.34777,466.33459 L937.22746,434.3797 L935.34777,383.62782 L929.70867,337.57519 L924.06957,285.88346 L914.67107,235.13158 L902.45303,212.57519 L877.07709,208.81579 L855.46055,190.0188 L852.641,162.76316 L851.70115,127.04887 L841.3628,94.15414 L826.32521,68.778196 L799.06957,47.161655 L753.95679,43.402256 L699.44551,45.281956 L642.11468,45.281956 L572.56581,52.800753 L510.53574,53.740602 L461.66355,55.620301 L409.97183,79.116542 L366.73874,105.43233 L318.80641,136.44737 L272.75378,182.5 L253.95679,214.45489 L247.37784,236.07143 L279.33273,232.31203 L273.69363,248.28947 L243.61844,281.18421 L219.18235,329.11654 L187.22746,391.14662 L158.09213,453.17669 L152.45303,467.27444 L129.89664,465.39474 z"
            transform="translate(24, -16)"
          />
        </g>

        {/* Seine River */}
        <path
          fill={MAP_INK}
          stroke={MAP_INK}
          strokeWidth="8"
          opacity="0.45"
          d="M 0.93984962,615.6015 C 9.3984962,627.81955 27.255639,653.19549 49.81203,656.01504 C 72.368421,658.83459 109.96241,639.09774 114.66165,635.33835 C 119.3609,631.57895 143.79699,608.08271 153.19549,594.92481 C 162.59398,581.76692 250,446.42857 250,446.42857 L 294.17293,397.55639 L 321.42857,365.6015 L 380.6391,355.26316 L 420.11278,355.26316 L 468.98496,373.1203 L 523.49624,396.61654 L 546.05263,415.41353 L 560.15038,429.51128 L 591.16541,444.54887 L 601.50376,445.48872 L 621.2406,457.70677 L 643.79699,471.80451 L 756.57895,596.80451 L 803.57143,653.19549 L 872.18045,690.78947 L 877.81955,702.06767 L 867.4812,749.06015"
          transform="translate(24, -16) scale(1.8)"
        />

        {/* Zones */}
        {HERO_ZONES.map((zone) => {
          const isHighlighted = zone.id === highlightedZone
          return (
            <g key={zone.id}>
              {/* Glow for highlighted */}
              {isHighlighted && (
                <motion.circle
                  cx={zone.center[0]}
                  cy={zone.center[1]}
                  r={60}
                  fill={SIGNAL_GLOW}
                  opacity={0.4}
                  filter="url(#hero-glow)"
                  animate={{ r: [55, 65, 55], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {/* Zone dot */}
              <circle
                cx={zone.center[0]}
                cy={zone.center[1]}
                r={isHighlighted ? 30 : 20}
                fill={isHighlighted ? SIGNAL_GREEN : MAP_INK}
                opacity={isHighlighted ? 0.9 : 0.4}
              />
              {/* Label */}
              <text
                x={zone.center[0]}
                y={zone.center[1] + 55}
                textAnchor="middle"
                fill={isHighlighted ? SIGNAL_GREEN : '#3a3835'}
                fontSize="28"
                fontFamily="system-ui, sans-serif"
                opacity={isHighlighted ? 0.9 : 0.5}
              >
                {zone.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
