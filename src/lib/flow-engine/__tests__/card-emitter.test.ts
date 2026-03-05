/**
 * FLOW Card Emitter Tests v1.6
 *
 * Tests for:
 * 1. TTL expiration — expired entries dropped silently
 * 2. READ mode — shows only action/place/why/window + MAJ if stale
 * 3. WhatsApp — equals compressed card one-liner
 * 4. Vocabulary firewall — banned terms never shown
 * 5. Generic skeleton filter — silence > vague
 * 6. Kind inference — confirme vs piste
 *
 * Run with: npx tsx src/lib/flow-engine/__tests__/card-emitter.test.ts
 */

import { buildFlowCard, type RamificationInput } from '../card-emitter'
import {
  filterExpiredOpportunities,
  computeOpportunityState,
  cardToWhatsApp,
  cardToHUD,
} from '@/types/flow-card'
import type { Opportunity, FlowCard } from '@/types/flow-card'
import type { CompiledBrief } from '@/lib/prompts/contracts'

// ── Simple test helpers ──

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`)
  }
  console.log(`  ✓ ${message}`)
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`)
  }
  console.log(`  ✓ ${message}`)
}

function assertContains(str: string, substring: string, message: string) {
  if (!str.includes(substring)) {
    throw new Error(`FAIL: ${message}\n  String "${str}" does not contain "${substring}"`)
  }
  console.log(`  ✓ ${message}`)
}

function assertNotContains(str: string, substring: string, message: string) {
  if (str.includes(substring)) {
    throw new Error(`FAIL: ${message}\n  String "${str}" should not contain "${substring}"`)
  }
  console.log(`  ✓ ${message}`)
}

// ── Test fixtures ──

function createTestBrief(overrides: Partial<CompiledBrief> = {}): CompiledBrief {
  return {
    meta: {
      timezone: 'Europe/Paris',
      generated_at: new Date().toISOString(),
      run_mode: 'daily',
      profile_variant: 'NIGHT_CHASER',
      confidence_overall: 0.7,
    },
    now_block: {
      window: '0-15min',
      actions: [],
      zones: ['Bastille'],
      rule: 'Test',
      micro_alerts: [],
      confidence: 0.7,
    },
    next_block: { slots: [], key_transition: '' },
    horizon_block: { hotspots: [], rules: [], expected_peaks: [] },
    summary: [],
    timeline: [],
    hotspots: [],
    alerts: [],
    rules: [],
    anti_clustering: { principle: '', dispatch_hint: [] },
    validation: { unknowns: [], do_not_assume: [] },
    ...overrides,
  }
}

function createTestRamification(id: string, overrides: Partial<RamificationInput> = {}): RamificationInput {
  const now = new Date()
  const windowStart = new Date(now.getTime() - 30 * 60000) // 30 min ago
  const windowEnd = new Date(now.getTime() + 30 * 60000) // 30 min from now

  return {
    id,
    pressureZones: ['Bastille'],
    explanation: 'bars pleins · sortie EST',
    regime: 'routine',
    confidence: 0.75,
    window: {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
    },
    ...overrides,
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 1: TTL EXPIRATION
// At 04:21, no "bars pleins" line is shown if its window ended and TTL expired
// ══════════════════════════════════════════════════════════════

function testTTLExpiration() {
  console.log('\n=== TEST: TTL Expiration ===')

  // Test 1: Drops opportunities silently after TTL expires
  {
    const now = new Date('2026-03-05T04:21:00+01:00')
    const windowEnd = new Date('2026-03-05T02:30:00+01:00')
    const ttlMinutes = 30
    const expiresAt = new Date(windowEnd.getTime() + ttlMinutes * 60000)

    const opportunity: Opportunity = {
      id: 'test-bars',
      ou: 'Bastille',
      quand: {
        start: '2026-03-05T01:30:00+01:00',
        end: windowEnd.toISOString(),
      },
      quoi: 'bars pleins · sortie EST',
      cause: 'bars',
      kind: 'confirme',
      corridor: 'est',
      state: 'horizon',
      confidence: 0.75,
      ttlMinutes,
      expiresAt: expiresAt.toISOString(),
    }

    const result = filterExpiredOpportunities([opportunity], now)
    assertEqual(result.length, 0, 'Expired opportunity dropped at 04:21 (expired at 03:00)')
  }

  // Test 2: Keeps opportunities within TTL window
  {
    const now = new Date('2026-03-05T02:45:00+01:00')
    const windowEnd = new Date('2026-03-05T02:30:00+01:00')
    const ttlMinutes = 30
    const expiresAt = new Date(windowEnd.getTime() + ttlMinutes * 60000)

    const opportunity: Opportunity = {
      id: 'test-bars',
      ou: 'Bastille',
      quand: {
        start: '2026-03-05T01:30:00+01:00',
        end: windowEnd.toISOString(),
      },
      quoi: 'bars pleins · sortie EST',
      cause: 'bars',
      kind: 'confirme',
      corridor: 'est',
      state: 'active',
      confidence: 0.75,
      ttlMinutes,
      expiresAt: expiresAt.toISOString(),
    }

    const result = filterExpiredOpportunities([opportunity], now)
    assertEqual(result.length, 1, 'Opportunity within TTL kept (02:45 < 03:00 expiry)')
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 2: READ MODE
// Shows only: action/place/why/window + MAJ time if stale
// ══════════════════════════════════════════════════════════════

function testReadMode() {
  console.log('\n=== TEST: READ Mode Card ===')

  const brief = createTestBrief()
  const ramifications: RamificationInput[] = [
    createTestRamification('ram-1', {
      pressureZones: ['Bastille'],
      explanation: 'bars pleins · sortie EST',
      confidence: 0.8,
    }),
  ]

  const card = buildFlowCard(brief, ramifications, null, null, 0)

  // Card has core fields for READ mode
  assert(card.action !== undefined, 'Card has action')
  assert(['rejoindre', 'maintenir', 'anticiper', 'repos'].includes(card.action), `Action is valid: ${card.action}`)
  assertEqual(card.actionZone, 'Bastille', 'Action zone is Bastille')
  assertContains(card.actionReason, 'bars', 'Action reason contains "bars"')
  assertContains(card.actionWindow, 'fenêtre', 'Action window contains "fenêtre"')
}

// ══════════════════════════════════════════════════════════════
// TEST 3: WHATSAPP MESSAGE
// Equals compressed card one-liner
// ══════════════════════════════════════════════════════════════

function testWhatsAppFormat() {
  console.log('\n=== TEST: WhatsApp Format ===')

  const card: FlowCard = {
    id: 'test-card',
    version: 1,
    emittedAt: new Date().toISOString(),
    hash: 'abc123',
    action: 'rejoindre',
    actionZone: 'Bastille',
    actionReason: 'bars pleins · sortie EST',
    actionWindow: 'fenêtre ~18 min',
    opportunities: [],
    context: {
      weather: null,
      transport: null,
      earnings: null,
    },
    revision: {
      number: 1,
      reason: 'initial',
      previousHash: null,
    },
    driverProfile: null,
    meta: {
      packDate: '2026-03-05',
      packCompiledAt: new Date().toISOString(),
      sourceCount: 3,
      overallConfidence: 0.75,
      stale: false,
    },
  }

  const whatsapp = cardToWhatsApp(card)
  assertEqual(
    whatsapp,
    'FLOW · REJOINDRE Bastille · bars pleins · sortie EST · fenêtre ~18 min',
    'WhatsApp format matches compressed one-liner'
  )

  // Test with context
  card.context.weather = 'pluie ~05h'
  card.context.transport = 'métro off'
  const whatsappWithContext = cardToWhatsApp(card)
  assertContains(whatsappWithContext, 'pluie ~05h', 'WhatsApp includes weather')
  assertContains(whatsappWithContext, 'métro off', 'WhatsApp includes transport')
}

// ══════════════════════════════════════════════════════════════
// TEST 4: VOCABULARY FIREWALL
// Banned terms never shown in driver-facing text
// ══════════════════════════════════════════════════════════════

function testVocabularyFirewall() {
  console.log('\n=== TEST: Vocabulary Firewall ===')

  const brief = createTestBrief()
  const ramifications: RamificationInput[] = [
    createTestRamification('ram-1', {
      explanation: 'signal fort · ramification bars · saturation élevée',
    }),
  ]

  const card = buildFlowCard(brief, ramifications, null, null, 0)

  // Banned terms should be stripped
  assertNotContains(card.actionReason, 'signal', 'Banned term "signal" removed')
  assertNotContains(card.actionReason, 'ramification', 'Banned term "ramification" removed')
  assertNotContains(card.actionReason, 'saturation', 'Banned term "saturation" removed')

  // Test allowed terms are preserved
  const ramifications2: RamificationInput[] = [
    createTestRamification('ram-2', {
      explanation: 'bars pleins · sortie EST · flux nuit',
    }),
  ]

  const card2 = buildFlowCard(brief, ramifications2, null, null, 0)
  assertContains(card2.actionReason, 'bars', 'Allowed term "bars" preserved')
  assertContains(card2.actionReason, 'sortie', 'Allowed term "sortie" preserved')
}

// ══════════════════════════════════════════════════════════════
// TEST 5: OPPORTUNITY STATE
// active / forming / horizon
// ══════════════════════════════════════════════════════════════

function testOpportunityState() {
  console.log('\n=== TEST: Opportunity State ===')

  const now = new Date()

  // Test active (within window)
  {
    const start = new Date(now.getTime() - 10 * 60000) // 10 min ago
    const end = new Date(now.getTime() + 20 * 60000) // 20 min from now
    const state = computeOpportunityState(
      { quand: { start: start.toISOString(), end: end.toISOString() } },
      now
    )
    assertEqual(state, 'active', 'State is active when within window')
  }

  // Test forming (starts within 30 min)
  {
    const start = new Date(now.getTime() + 15 * 60000) // 15 min from now
    const end = new Date(now.getTime() + 60 * 60000) // 1h from now
    const state = computeOpportunityState(
      { quand: { start: start.toISOString(), end: end.toISOString() } },
      now
    )
    assertEqual(state, 'forming', 'State is forming when starts within 30 min')
  }

  // Test horizon (far away)
  {
    const start = new Date(now.getTime() + 2 * 60 * 60000) // 2h from now
    const end = new Date(now.getTime() + 3 * 60 * 60000) // 3h from now
    const state = computeOpportunityState(
      { quand: { start: start.toISOString(), end: end.toISOString() } },
      now
    )
    assertEqual(state, 'horizon', 'State is horizon when far away')
  }
}

// ══════════════════════════════════════════════════════════════
// TEST 6: HUD FORMAT
// Ultra-compressed for watch/HUD
// ══════════════════════════════════════════════════════════════

function testHUDFormat() {
  console.log('\n=== TEST: HUD Format ===')

  const card: FlowCard = {
    id: 'test',
    version: 1,
    emittedAt: new Date().toISOString(),
    hash: 'abc',
    action: 'rejoindre',
    actionZone: 'Bastille',
    actionReason: 'bars',
    actionWindow: '~18 min',
    opportunities: [
      {
        id: '1',
        ou: 'Bastille',
        quand: { start: '2026-03-05T23:00:00Z', end: '2026-03-05T23:30:00Z' },
        quoi: 'bars',
        cause: 'bars',
        kind: 'confirme',
        corridor: 'est',
        state: 'active',
        confidence: 0.8,
        ttlMinutes: 30,
        expiresAt: '2026-03-06T00:00:00Z',
      },
      {
        id: '2',
        ou: 'Pigalle',
        quand: { start: '2026-03-06T00:00:00Z', end: '2026-03-06T01:00:00Z' },
        quoi: 'clubs',
        cause: 'bars',
        kind: 'piste',
        corridor: 'nord',
        state: 'forming',
        confidence: 0.6,
        ttlMinutes: 30,
        expiresAt: '2026-03-06T01:30:00Z',
      },
    ],
    context: { weather: null, transport: null, earnings: null },
    revision: { number: 1, reason: 'initial', previousHash: null },
    driverProfile: null,
    meta: { packDate: '2026-03-05', packCompiledAt: '', sourceCount: 0, overallConfidence: 0.7, stale: false },
  }

  const hud = cardToHUD(card)

  assertContains(hud, 'BAS', 'HUD contains BAS (Bastille)')
  assertContains(hud, 'PIG', 'HUD contains PIG (Pigalle)')
  assertContains(hud, '●', 'HUD contains ● (active)')
  assertContains(hud, '○', 'HUD contains ○ (forming)')
}

// ══════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ══════════════════════════════════════════════════════════════

function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗')
  console.log('║  FLOW Card Emitter v1.6 — Test Suite                     ║')
  console.log('╚═══════════════════════════════════════════════════════════╝')

  try {
    testTTLExpiration()
    testReadMode()
    testWhatsAppFormat()
    testVocabularyFirewall()
    testOpportunityState()
    testHUDFormat()

    console.log('\n════════════════════════════════════════════════════════════')
    console.log('✓ ALL TESTS PASSED')
    console.log('════════════════════════════════════════════════════════════')
    process.exit(0)
  } catch (err) {
    console.error('\n════════════════════════════════════════════════════════════')
    console.error('✗ TEST FAILED')
    console.error('════════════════════════════════════════════════════════════')
    console.error(err)
    process.exit(1)
  }
}

runAllTests()
