'use client'

// ============================================
// PARIS FIELD MAP
// ============================================
// Real Paris SVG base with zone overlays.
// Every visual element maps to FieldState.
// No decorative animation — motion encodes information.
// ============================================

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useFieldState,
  useRhythm,
  useReadability,
  useDriverContext,
} from '@/lib/field-state'
import type { ZoneState, ZonePhase } from '@/lib/field-state/types'
import { arche } from '@/lib/design/tokens'

// ════════════════════════════════════════
// ZONE DEFINITIONS (Real Paris coordinates)
// ViewBox: 0 0 2037.566 1615.5
// ════════════════════════════════════════

interface ZoneDefinition {
  id: string
  label: string
  shortLabel: string
  center: [number, number]
  weight: 'major' | 'standard' | 'minor'
}

const PARIS_ZONES: ZoneDefinition[] = [
  // GARES — High transit
  { id: 'gare-nord', label: 'Gare du Nord', shortLabel: 'Nord', center: [1100, 280], weight: 'major' },
  { id: 'gare-est', label: "Gare de l'Est", shortLabel: 'Est', center: [1180, 320], weight: 'major' },
  { id: 'gare-lyon', label: 'Gare de Lyon', shortLabel: 'Lyon', center: [1320, 1050], weight: 'major' },
  { id: 'saint-lazare', label: 'Saint-Lazare', shortLabel: 'Lazare', center: [780, 340], weight: 'major' },
  { id: 'montparnasse', label: 'Montparnasse', shortLabel: 'Montp.', center: [680, 1100], weight: 'major' },

  // NIGHTLIFE — High volatility
  { id: 'bastille', label: 'Bastille', shortLabel: 'Bastille', center: [1200, 900], weight: 'major' },
  { id: 'oberkampf', label: 'Oberkampf', shortLabel: 'Ober.', center: [1250, 700], weight: 'standard' },
  { id: 'pigalle', label: 'Pigalle', shortLabel: 'Pigalle', center: [900, 200], weight: 'standard' },
  { id: 'marais', label: 'Le Marais', shortLabel: 'Marais', center: [1100, 780], weight: 'standard' },
  { id: 'chatelet', label: 'Châtelet', shortLabel: 'Châtelet', center: [950, 750], weight: 'major' },

  // BUSINESS — Predictable peaks
  { id: 'opera', label: 'Opéra', shortLabel: 'Opéra', center: [850, 500], weight: 'major' },
  { id: 'madeleine', label: 'Madeleine', shortLabel: 'Madel.', center: [750, 480], weight: 'standard' },
  { id: 'champs', label: 'Champs-Élysées', shortLabel: 'Champs', center: [550, 550], weight: 'major' },
  { id: 'trocadero', label: 'Trocadéro', shortLabel: 'Troca.', center: [400, 700], weight: 'standard' },
  { id: 'invalides', label: 'Invalides', shortLabel: 'Inval.', center: [580, 820], weight: 'standard' },
  { id: 'defense', label: 'La Défense', shortLabel: 'Défense', center: [200, 400], weight: 'major' },

  // OTHER KEY AREAS
  { id: 'latin', label: 'Quartier Latin', shortLabel: 'Latin', center: [900, 1000], weight: 'standard' },
  { id: 'republique', label: 'République', shortLabel: 'Répub.', center: [1150, 550], weight: 'standard' },
  { id: 'belleville', label: 'Belleville', shortLabel: 'Bellev.', center: [1350, 500], weight: 'minor' },
  { id: 'nation', label: 'Nation', shortLabel: 'Nation', center: [1500, 900], weight: 'standard' },
  { id: 'bercy', label: 'Bercy', shortLabel: 'Bercy', center: [1450, 1100], weight: 'standard' },
]

// ════════════════════════════════════════
// COLOR PALETTE (ARCHÉ compat: mapInk, green, gold)
// ════════════════════════════════════════
// Tracés = mapInk; active/peak = green; forming = gold. Breath unchanged.
const MAP_INK = '#3c3f3a' // ARCHÉ mapInk (60,63,58) for strokes on void
const GREEN_ACTIVE = '#0d4a38'
const GREEN_ACTIVE_GLOW = '#1a5c48'
const GREEN_PEAK = '#1a5c48'
const GREEN_PEAK_GLOW = '#2a7562'
const GOLD_FORMING = '#5c4d3a'
const GOLD_FORMING_GLOW = '#7a6847'

const COLORS = {
  void: '#0a0a0b',
  surface: '#111113',

  // Map strokes — ARCHÉ mapInk
  mapStroke: MAP_INK,
  seine: MAP_INK,

  // Zones by phase
  dormant: '#1a1918',
  dormantGlow: '#252422',
  forming: GOLD_FORMING,
  formingGlow: GOLD_FORMING_GLOW,
  active: GREEN_ACTIVE,
  activeGlow: GREEN_ACTIVE_GLOW,
  peak: GREEN_PEAK,
  peakGlow: GREEN_PEAK_GLOW,
  fading: '#2a3328',
  fadingGlow: '#3a4538',
  echo: '#1a1918',
  echoGlow: '#252422',

  // Selection — ARCHÉ green family
  selected: arche.green,
  selectedGlow: '#1a7a5c',

  // Labels
  labelDim: '#3a3835',
  labelVisible: '#5a5550',
}

function getPhaseColors(phase: ZonePhase): { fill: string; glow: string } {
  switch (phase) {
    case 'dormant': return { fill: COLORS.dormant, glow: COLORS.dormantGlow }
    case 'forming': return { fill: COLORS.forming, glow: COLORS.formingGlow }
    case 'active': return { fill: COLORS.active, glow: COLORS.activeGlow }
    case 'peak': return { fill: COLORS.peak, glow: COLORS.peakGlow }
    case 'fading': return { fill: COLORS.fading, glow: COLORS.fadingGlow }
    case 'echo': return { fill: COLORS.echo, glow: COLORS.echoGlow }
    default: return { fill: COLORS.dormant, glow: COLORS.dormantGlow }
  }
}

// ════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════

interface ParisFieldMapProps {
  interactive?: boolean
  onZoneClick?: (zoneId: string) => void
  compact?: boolean
  className?: string
}

export function ParisFieldMap({
  interactive = false,
  onZoneClick,
  compact = false,
  className = '',
}: ParisFieldMapProps) {
  const fieldState = useFieldState((s) => s.state)
  const tickBreath = useFieldState((s) => s.tickBreath)
  const rhythm = useRhythm()
  const readability = useReadability()
  const driverContext = useDriverContext()

  const [hoveredZone, setHoveredZone] = useState<string | null>(null)
  const lastTickRef = useRef(Date.now())
  const animFrameRef = useRef(0)

  // Breath Animation Loop
  useEffect(() => {
    if (!readability.rhythm) return

    let active = true
    const tick = () => {
      if (!active) return
      const now = Date.now()
      const delta = now - lastTickRef.current
      lastTickRef.current = now
      tickBreath(delta)
      animFrameRef.current = requestAnimationFrame(tick)
    }

    animFrameRef.current = requestAnimationFrame(tick)
    return () => {
      active = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [readability.rhythm, tickBreath])

  const breathValue = Math.sin(rhythm.breathPhase * Math.PI * 2) * 0.5 + 0.5
  const globalOpacity = readability.level

  const handleZoneClick = useCallback(
    (zoneId: string) => {
      if (interactive && onZoneClick) {
        onZoneClick(zoneId)
      }
    },
    [interactive, onZoneClick]
  )

  return (
    <div
      className={`relative ${className}`}
      style={{
        opacity: 0.15 + globalOpacity * 0.85,
        transition: 'opacity 0.5s ease',
      }}
    >
      <svg
        viewBox="0 0 2037.566 1615.5"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: COLORS.void }}
      >
        {/* Filters */}
        <defs>
          <filter id="zone-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="12" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background */}
        <rect x="0" y="0" width="2037.566" height="1615.5" fill={COLORS.void} />

        {/* Paris Base Map - Districts Boundaries */}
        <g id="paris-map" opacity={0.5 + breathValue * 0.1}>
          {/* Main district lines */}
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="860.566,730.5 865.066,721.5 891.566,670.5 895.066,666 916.566,620.5 914.566,611 923.566,608.5 949.066,602.5 977.066,632.5 1019.066,648 1045.566,657 1111.566,680.5 1179.066,704.5 1231.566,723.5 1222.066,750 1198.066,815 1188.566,839 1182.566,842.5 1177.066,857 1170.066,872.5 1155.566,894.5 1152.566,897.5 1150.066,901.5 1130.066,965 1129.566,966.5 1107.566,1022.5 1065.066,1138.5 1056.066,1152 1056.066,1166 1093.566,1180.5 1122.066,1190.5 1183.066,1209 1207.066,1214 1240.566,1219.5 1243.066,1218.5 1365.566,1160 1406.066,1076 1413.066,1062.5"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="1231.566,723.5 1239.066,704 1272.566,613 1193.566,588 1135.066,573.5 1098.066,564 1061.566,573.5 1059.566,574 949.066,602.5"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="1222.066,750 1242.066,756 1263.066,764 1305.066,785.5 1330.066,813 1365.566,838.5 1396.066,853 1447.566,866 1444.066,843.5 1432.066,769 1428.066,740 1426.066,729 1395.066,651 1390.066,646.5 1385.066,642 1300.566,622.5 1272.566,613"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="1056.066,1166 908.566,1091.5 841.066,1056.5 809.066,1032.5 844.566,1012.5 858.066,1002 891.566,975.5 935.566,947.5 934.566,943 953.566,939.5 965.566,924 979.066,890.5 983.066,876.5 1017.066,814.5 1022.066,804.5"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="809.066,1032.5 774.066,1048.5 735.566,1011 695.566,1026 652.566,984.5 618.566,951 617.066,952.5 487.066,825 481.066,819"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="923.566,608.5 933.566,546 938.066,533.5 932.566,497 935.566,497.5 940.066,351 808.066,390.5 717.566,406.5 713.566,408.5 644.066,431 617.566,440 583.566,450 544.566,531 574.066,582.5 592.066,628.5 605.066,692.5 624.066,703 624.566,713"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="1193.566,588 1193.566,526.5 1198.566,488.5 1203.066,476.5 1208.566,464 1210.566,435.5 1217.066,406 1217.566,402 1214.066,345 1182.066,351 1092.566,376.5 1070.566,371.5 1064.566,370 1006.566,344.5 967.566,329.5 947.566,347.5 942.566,350 940.066,351"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="1390.066,646.5 1419.566,629.5 1433.066,623.5 1457.566,610 1468.566,604.5 1501.066,589.5 1551.066,561.5 1469.566,451 1469.066,366.5 1467.566,362.5 1456.066,353 1450.066,340 1448.566,337 1401.066,333 1334.566,331.5 1214.066,345"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="1454.566,913 1468.566,910.5 1485.066,925.5 1512.566,937.5 1565.566,957.5 1582.066,962.5 1628.566,966.5 1642.066,968.5 1646.066,970.5 1784.566,1002 1823.066,1007 1825.066,992 1815.066,947 1766.066,849.5 1739.066,828.5 1707.066,814 1679.566,732.5 1630.566,664.5 1628.066,654.5 1576.066,594.5 1551.066,561.5"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="1122.066,1190.5 1117.566,1244.5 1111.066,1297.5 1111.066,1312.5 1113.066,1351.5 1116.066,1368.5 1116.566,1400.5 1118.066,1411.5 1114.066,1464.5 1119.066,1487.5 1128.066,1506 1142.066,1523 1153.066,1541 1141.066,1608"/>
          <polyline fill="none" stroke={COLORS.mapStroke} strokeWidth="2" points="908.566,1091.5 883.566,1123 874.066,1118.5 866.066,1128.5 807.566,1198.5 762.066,1255 618.066,1435.5 779.066,1490 963.566,1552 1002.566,1565 995.566,1586.5 1018.066,1591.5 1126.566,1601 1141.066,1608"/>

          {/* Arrondissements - subtle outlines */}
          <g opacity={0.2}>
            {/* 1er - Louvre/Châtelet area */}
            <ellipse cx="920" cy="720" rx="80" ry="60" fill="none" stroke={COLORS.mapStroke} strokeWidth="1" strokeDasharray="4,4" />
            {/* 2e - Bourse */}
            <ellipse cx="900" cy="580" rx="60" ry="45" fill="none" stroke={COLORS.mapStroke} strokeWidth="1" strokeDasharray="4,4" />
            {/* 3e-4e - Marais */}
            <ellipse cx="1080" cy="750" rx="100" ry="80" fill="none" stroke={COLORS.mapStroke} strokeWidth="1" strokeDasharray="4,4" />
            {/* 8e - Champs */}
            <ellipse cx="580" cy="520" rx="120" ry="90" fill="none" stroke={COLORS.mapStroke} strokeWidth="1" strokeDasharray="4,4" />
            {/* 9e-10e - Gares */}
            <ellipse cx="1000" cy="380" rx="180" ry="100" fill="none" stroke={COLORS.mapStroke} strokeWidth="1" strokeDasharray="4,4" />
            {/* 11e - Bastille/Oberkampf */}
            <ellipse cx="1280" cy="780" rx="120" ry="140" fill="none" stroke={COLORS.mapStroke} strokeWidth="1" strokeDasharray="4,4" />
            {/* 18e - Pigalle/Montmartre */}
            <ellipse cx="900" cy="220" rx="140" ry="80" fill="none" stroke={COLORS.mapStroke} strokeWidth="1" strokeDasharray="4,4" />
          </g>

          {/* Outer border */}
          <path fill="none" stroke={COLORS.mapStroke} strokeWidth="2.5" d="M129.89664,465.39474 L115.79889,484.19173 L120.49814,520.84587 L154.33273,553.7406 L183.46807,557.5 L213.54325,567.83834 L232.34025,561.2594 L251.13724,580.52632 L291.55077,601.67293 L348.8816,633.62782 L415.61092,654.30451 L486.09965,674.04135 L509.59589,688.1391 L551.88912,705.99624 L601.70115,700.35714 L623.31769,687.19925 C623.31769,687.19925 647.75378,693.7782 651.51318,693.7782 C655.27258,693.7782 698.50566,688.1391 698.50566,688.1391 L744.55829,656.18421 L790.61092,630.80827 L831.02446,604.49248 L864.85905,584.75564 L852.641,569.71805 L886.47558,545.28196 L911.85152,552.80075 L925.94927,510.50752 L926.88912,491.71053 L935.34777,466.33459 L937.22746,434.3797 L935.34777,383.62782 L929.70867,337.57519 L924.06957,285.88346 L914.67107,235.13158 L902.45303,212.57519 L877.07709,208.81579 L855.46055,190.0188 L852.641,162.76316 L851.70115,127.04887 L841.3628,94.15414 L826.32521,68.778196 L799.06957,47.161655 L753.95679,43.402256 L699.44551,45.281956 L642.11468,45.281956 L572.56581,52.800753 L510.53574,53.740602 L461.66355,55.620301 L409.97183,79.116542 L366.73874,105.43233 L318.80641,136.44737 L272.75378,182.5 L253.95679,214.45489 L247.37784,236.07143 L279.33273,232.31203 L273.69363,248.28947 L243.61844,281.18421 L219.18235,329.11654 L187.22746,391.14662 L158.09213,453.17669 L152.45303,467.27444 L129.89664,465.39474 z" transform="translate(24, -16)"/>

          {/* Seine River */}
          <path fill={COLORS.seine} stroke={COLORS.seine} strokeWidth="8" opacity="0.5" d="M 0.93984962,615.6015 C 9.3984962,627.81955 27.255639,653.19549 49.81203,656.01504 C 72.368421,658.83459 109.96241,639.09774 114.66165,635.33835 C 119.3609,631.57895 143.79699,608.08271 153.19549,594.92481 C 162.59398,581.76692 250,446.42857 250,446.42857 L 294.17293,397.55639 L 321.42857,365.6015 L 380.6391,355.26316 L 420.11278,355.26316 L 468.98496,373.1203 L 523.49624,396.61654 L 546.05263,415.41353 L 560.15038,429.51128 L 591.16541,444.54887 L 601.50376,445.48872 L 621.2406,457.70677 L 643.79699,471.80451 L 756.57895,596.80451 L 803.57143,653.19549 L 872.18045,690.78947 L 877.81955,702.06767 L 867.4812,749.06015" transform="translate(24, -16) scale(1.8)" />
        </g>

        {/* Zone Overlays */}
        {readability.zones && PARIS_ZONES.map((zoneDef) => {
          const zoneState = fieldState.zones.get(zoneDef.id)
          const isSelected = driverContext.selectedZones.includes(zoneDef.id)
          const isHovered = hoveredZone === zoneDef.id

          const intensity = zoneState?.intensity ?? 0.2
          const phase = zoneState?.phase ?? 'dormant'
          const volatility = zoneState?.volatility ?? 0
          const confidence = zoneState?.confidence ?? 0.5

          const { fill, glow } = isSelected
            ? { fill: COLORS.selected, glow: COLORS.selectedGlow }
            : getPhaseColors(phase)

          const baseRadius = zoneDef.weight === 'major' ? 35 : zoneDef.weight === 'standard' ? 25 : 18
          const breathModulation = volatility * 0.3
          const currentBreath = 1 + breathValue * breathModulation
          const glowOpacity = intensity * 0.6

          return (
            <g
              key={zoneDef.id}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
              onMouseEnter={() => setHoveredZone(zoneDef.id)}
              onMouseLeave={() => setHoveredZone(null)}
              onClick={() => handleZoneClick(zoneDef.id)}
            >
              {/* Glow layer */}
              {intensity > 0.1 && (
                <circle
                  cx={zoneDef.center[0]}
                  cy={zoneDef.center[1]}
                  r={baseRadius * 2.5 * currentBreath}
                  fill={glow}
                  opacity={glowOpacity}
                  filter="url(#zone-glow)"
                  style={{ transition: 'r 0.5s ease, opacity 0.5s ease' }}
                />
              )}

              {/* Main node */}
              <circle
                cx={zoneDef.center[0]}
                cy={zoneDef.center[1]}
                r={baseRadius * currentBreath}
                fill={fill}
                opacity={0.3 + intensity * 0.7}
                filter={confidence > 0.7 ? 'none' : 'url(#soft-glow)'}
                stroke={isHovered ? COLORS.labelVisible : 'none'}
                strokeWidth={isHovered ? 2 : 0}
                style={{ transition: 'all 0.3s ease' }}
              />

              {/* Selection ring */}
              {isSelected && (
                <circle
                  cx={zoneDef.center[0]}
                  cy={zoneDef.center[1]}
                  r={baseRadius * 1.6}
                  fill="none"
                  stroke={COLORS.selected}
                  strokeWidth={2.5}
                  opacity={0.6 + breathValue * 0.3}
                />
              )}

              {/* Label */}
              {readability.labels && intensity > 0.15 && (
                <text
                  x={zoneDef.center[0]}
                  y={zoneDef.center[1] + baseRadius + 20}
                  textAnchor="middle"
                  fill={isSelected ? COLORS.selected : COLORS.labelDim}
                  fontSize="24"
                  fontFamily="system-ui, sans-serif"
                  opacity={0.5 + intensity * 0.5}
                  style={{ pointerEvents: 'none' }}
                >
                  {zoneDef.shortLabel}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredZone && readability.labels && (
          <ZoneTooltip
            zoneId={hoveredZone}
            zone={PARIS_ZONES.find(z => z.id === hoveredZone)}
            state={fieldState.zones.get(hoveredZone)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════
// TOOLTIP
// ════════════════════════════════════════

interface ZoneTooltipProps {
  zoneId: string
  zone: ZoneDefinition | undefined
  state: ZoneState | undefined
}

function ZoneTooltip({ zoneId, zone, state }: ZoneTooltipProps) {
  if (!zone) return null

  const phaseLabels: Record<ZonePhase, string> = {
    dormant: 'Calme',
    forming: 'En formation',
    active: 'Fenêtre active',
    peak: 'Pic',
    fading: 'Se ferme',
    echo: 'Trace',
  }

  return (
    <motion.div
      className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
    >
      <div
        className="px-4 py-2 rounded"
        style={{
          backgroundColor: 'rgba(10, 10, 11, 0.95)',
          border: '1px solid #1a1918',
        }}
      >
        <p className="text-xs text-[#5a5550] uppercase tracking-wider mb-1">
          {zone.label}
        </p>
        {state && (
          <p className="text-[10px] text-[#4a4540]">
            {phaseLabels[state.phase]} · {Math.round(state.intensity * 100)}%
          </p>
        )}
      </div>
    </motion.div>
  )
}
