/**
 * Subscription Manager — v1.6
 *
 * Manages driver WhatsApp subscriptions in Supabase.
 * Handles opt-in, opt-out, preferences, and alert logging.
 */

import { createClient } from '@supabase/supabase-js'
import type {
  DriverSubscription,
  WhatsAppInbound,
  AlertLog,
  SubscriptionStatus,
  CorridorPreference,
  AlertKind,
  AlertStatus,
} from './types'

// ════════════════════════════════════════════════════════════════
// SUPABASE CLIENT
// ════════════════════════════════════════════════════════════════

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase not configured')
  }

  return createClient(url, key)
}

// ════════════════════════════════════════════════════════════════
// SUBSCRIPTION OPERATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Get or create a driver subscription.
 */
export async function getOrCreateSubscription(phoneE164: string): Promise<DriverSubscription> {
  const supabase = getSupabaseClient()

  // Try to find existing
  const { data: existing, error: findError } = await supabase
    .from('driver_subscriptions')
    .select('*')
    .eq('phone_e164', phoneE164)
    .single()

  if (existing && !findError) {
    return existing as DriverSubscription
  }

  // Create new
  const newSub: Partial<DriverSubscription> = {
    phone_e164: phoneE164,
    status: 'pending',
    opted_in_at: null,
    opted_out_at: null,
    prefs_corridors: ['nord', 'est', 'sud', 'ouest'], // All corridors by default
    prefs_time_window: 'all',
    max_alerts_per_night: 3,
    alerts_sent_tonight: 0,
    last_alert_at: null,
    last_menu_state: 'main',
  }

  const { data: created, error: createError } = await supabase
    .from('driver_subscriptions')
    .insert(newSub)
    .select()
    .single()

  if (createError) {
    console.error('[Subscription] Create error:', createError)
    throw createError
  }

  return created as DriverSubscription
}

/**
 * Update subscription status (opt-in / opt-out).
 */
export async function updateSubscriptionStatus(
  phoneE164: string,
  status: SubscriptionStatus
): Promise<DriverSubscription> {
  const supabase = getSupabaseClient()

  const update: Partial<DriverSubscription> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'opted_in') {
    update.opted_in_at = new Date().toISOString()
  } else if (status === 'opted_out') {
    update.opted_out_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('driver_subscriptions')
    .update(update)
    .eq('phone_e164', phoneE164)
    .select()
    .single()

  if (error) {
    console.error('[Subscription] Update status error:', error)
    throw error
  }

  return data as DriverSubscription
}

/**
 * Toggle a corridor preference.
 */
export async function toggleCorridorPreference(
  phoneE164: string,
  corridor: CorridorPreference
): Promise<{ subscription: DriverSubscription; enabled: boolean }> {
  const supabase = getSupabaseClient()

  // Get current
  const sub = await getOrCreateSubscription(phoneE164)
  const currentCorridors = sub.prefs_corridors || []

  // Toggle
  let newCorridors: CorridorPreference[]
  let enabled: boolean

  if (currentCorridors.includes(corridor)) {
    // Remove
    newCorridors = currentCorridors.filter(c => c !== corridor)
    enabled = false
  } else {
    // Add
    newCorridors = [...currentCorridors, corridor]
    enabled = true
  }

  // Update
  const { data, error } = await supabase
    .from('driver_subscriptions')
    .update({
      prefs_corridors: newCorridors,
      updated_at: new Date().toISOString(),
    })
    .eq('phone_e164', phoneE164)
    .select()
    .single()

  if (error) {
    console.error('[Subscription] Toggle corridor error:', error)
    throw error
  }

  return { subscription: data as DriverSubscription, enabled }
}

/**
 * Set time window preference.
 */
export async function setTimeWindowPreference(
  phoneE164: string,
  timeWindow: 'all' | '22h-02h' | '00h-05h'
): Promise<DriverSubscription> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('driver_subscriptions')
    .update({
      prefs_time_window: timeWindow,
      updated_at: new Date().toISOString(),
    })
    .eq('phone_e164', phoneE164)
    .select()
    .single()

  if (error) {
    console.error('[Subscription] Set time window error:', error)
    throw error
  }

  return data as DriverSubscription
}

/**
 * Update menu state.
 */
export async function updateMenuState(
  phoneE164: string,
  menuState: 'main' | 'settings' | 'example'
): Promise<void> {
  const supabase = getSupabaseClient()

  await supabase
    .from('driver_subscriptions')
    .update({
      last_menu_state: menuState,
      updated_at: new Date().toISOString(),
    })
    .eq('phone_e164', phoneE164)
}

/**
 * Get all opted-in drivers for a corridor.
 */
export async function getOptedInDrivers(corridor?: CorridorPreference): Promise<DriverSubscription[]> {
  const supabase = getSupabaseClient()

  let query = supabase
    .from('driver_subscriptions')
    .select('*')
    .eq('status', 'opted_in')

  if (corridor) {
    query = query.contains('prefs_corridors', [corridor])
  }

  const { data, error } = await query

  if (error) {
    console.error('[Subscription] Get opted-in error:', error)
    return []
  }

  return (data || []) as DriverSubscription[]
}

/**
 * Check if driver can receive alert (under limit).
 */
export async function canReceiveAlert(phoneE164: string): Promise<boolean> {
  const sub = await getOrCreateSubscription(phoneE164)

  if (sub.status !== 'opted_in') return false
  if (sub.alerts_sent_tonight >= sub.max_alerts_per_night) return false

  return true
}

/**
 * Increment alert count for tonight.
 */
export async function incrementAlertCount(phoneE164: string): Promise<void> {
  const supabase = getSupabaseClient()

  const sub = await getOrCreateSubscription(phoneE164)

  await supabase
    .from('driver_subscriptions')
    .update({
      alerts_sent_tonight: (sub.alerts_sent_tonight || 0) + 1,
      last_alert_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('phone_e164', phoneE164)
}

/**
 * Reset alert counts for all drivers (call at 06:00 Paris time).
 */
export async function resetAlertCounts(): Promise<number> {
  const supabase = getSupabaseClient()

  const { data, error } = await supabase
    .from('driver_subscriptions')
    .update({
      alerts_sent_tonight: 0,
      updated_at: new Date().toISOString(),
    })
    .gt('alerts_sent_tonight', 0)
    .select()

  if (error) {
    console.error('[Subscription] Reset counts error:', error)
    return 0
  }

  return data?.length || 0
}

// ════════════════════════════════════════════════════════════════
// INBOUND LOG
// ════════════════════════════════════════════════════════════════

/**
 * Log an inbound WhatsApp message.
 */
export async function logInboundMessage(
  phoneE164: string,
  messageText: string,
  messageSid: string | null
): Promise<WhatsAppInbound> {
  const supabase = getSupabaseClient()

  const log: Partial<WhatsAppInbound> = {
    phone_e164: phoneE164,
    message_text: messageText,
    message_sid: messageSid,
    received_at: new Date().toISOString(),
    processed: false,
    response_sent: null,
  }

  const { data, error } = await supabase
    .from('whatsapp_inbound')
    .insert(log)
    .select()
    .single()

  if (error) {
    console.error('[Inbound] Log error:', error)
    throw error
  }

  return data as WhatsAppInbound
}

/**
 * Mark inbound message as processed.
 */
export async function markInboundProcessed(
  id: string,
  responseSent: string
): Promise<void> {
  const supabase = getSupabaseClient()

  await supabase
    .from('whatsapp_inbound')
    .update({
      processed: true,
      response_sent: responseSent,
    })
    .eq('id', id)
}

// ════════════════════════════════════════════════════════════════
// ALERT LOG
// ════════════════════════════════════════════════════════════════

/**
 * Check if alert was already sent (deduplication).
 */
export async function wasAlertSent(dedupeKey: string): Promise<boolean> {
  const supabase = getSupabaseClient()

  const { data } = await supabase
    .from('alert_logs')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .single()

  return !!data
}

/**
 * Log an outbound alert.
 */
export async function logAlert(
  phoneE164: string,
  dedupeKey: string,
  kind: AlertKind,
  messageText: string,
  messageSid: string | null,
  status: AlertStatus
): Promise<AlertLog> {
  const supabase = getSupabaseClient()

  const log: Partial<AlertLog> = {
    phone_e164: phoneE164,
    dedupe_key: dedupeKey,
    kind,
    message_text: messageText,
    message_sid: messageSid,
    status,
    sent_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('alert_logs')
    .insert(log)
    .select()
    .single()

  if (error) {
    console.error('[Alert] Log error:', error)
    throw error
  }

  return data as AlertLog
}

/**
 * Update alert status (delivered, read, failed).
 */
export async function updateAlertStatus(
  messageSid: string,
  status: AlertStatus,
  errorMessage?: string
): Promise<void> {
  const supabase = getSupabaseClient()

  const update: Partial<AlertLog> = { status }

  if (status === 'delivered') {
    update.delivered_at = new Date().toISOString()
  }
  if (errorMessage) {
    update.error_message = errorMessage
  }

  await supabase
    .from('alert_logs')
    .update(update)
    .eq('message_sid', messageSid)
}
