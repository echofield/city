/**
 * WhatsApp Integration Types — v1.6
 *
 * Numeric opt-in protocol for French VTC drivers.
 * Uses Twilio as WhatsApp Business API provider.
 */

// ════════════════════════════════════════════════════════════════
// DRIVER SUBSCRIPTION
// ════════════════════════════════════════════════════════════════

export type SubscriptionStatus = 'pending' | 'opted_in' | 'opted_out'

export type CorridorPreference = 'nord' | 'est' | 'sud' | 'ouest'

export type MenuState = 'main' | 'settings' | 'example'

export interface DriverSubscription {
  id: string
  phone_e164: string
  status: SubscriptionStatus
  opted_in_at: string | null
  opted_out_at: string | null
  prefs_corridors: CorridorPreference[]
  prefs_time_window: 'all' | '22h-02h' | '00h-05h'
  max_alerts_per_night: number
  alerts_sent_tonight: number
  last_alert_at: string | null
  last_menu_state: MenuState
  created_at: string
  updated_at: string
}

// ════════════════════════════════════════════════════════════════
// WHATSAPP INBOUND LOG
// ════════════════════════════════════════════════════════════════

export interface WhatsAppInbound {
  id: string
  phone_e164: string
  message_text: string
  message_sid: string | null
  received_at: string
  processed: boolean
  response_sent: string | null
}

// ════════════════════════════════════════════════════════════════
// ALERT LOG
// ════════════════════════════════════════════════════════════════

export type AlertKind = 'action_now' | 'upcoming_peak' | 'calm_state' | 'metro_closing' | 'rain_starting'

export type AlertStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed'

export interface AlertLog {
  id: string
  phone_e164: string
  dedupe_key: string
  kind: AlertKind
  message_text: string
  message_sid: string | null
  status: AlertStatus
  sent_at: string
  delivered_at: string | null
  error_message: string | null
}

// ════════════════════════════════════════════════════════════════
// TWILIO WEBHOOK PAYLOAD
// ════════════════════════════════════════════════════════════════

export interface TwilioInboundPayload {
  MessageSid: string
  AccountSid: string
  From: string // "whatsapp:+33612345678"
  To: string   // "whatsapp:+14155238886"
  Body: string
  NumMedia?: string
  ProfileName?: string
}

// ════════════════════════════════════════════════════════════════
// OUTBOUND MESSAGE
// ════════════════════════════════════════════════════════════════

export interface OutboundMessage {
  to: string // E.164 format
  body: string
  templateSid?: string
  templateVariables?: Record<string, string>
}

export interface SendResult {
  success: boolean
  messageSid?: string
  error?: string
}
