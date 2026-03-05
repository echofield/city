/**
 * Twilio WhatsApp Client — v1.6
 *
 * Sends and receives WhatsApp messages via Twilio API.
 * Handles signature verification for webhook security.
 */

import crypto from 'crypto'
import type { OutboundMessage, SendResult, TwilioInboundPayload } from './types'

// ════════════════════════════════════════════════════════════════
// ENV CONFIG
// ════════════════════════════════════════════════════════════════

function getTwilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || '', // e.g., "+14155238886"
  }
}

export function isTwilioConfigured(): boolean {
  const config = getTwilioConfig()
  return !!(config.accountSid && config.authToken && config.whatsappNumber)
}

// ════════════════════════════════════════════════════════════════
// SIGNATURE VERIFICATION
// ════════════════════════════════════════════════════════════════

/**
 * Verify Twilio webhook signature.
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function verifyTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  const config = getTwilioConfig()
  if (!config.authToken) return false

  // Build the data string: URL + sorted params
  const sortedKeys = Object.keys(params).sort()
  let data = url
  for (const key of sortedKeys) {
    data += key + params[key]
  }

  // Compute HMAC-SHA1
  const hmac = crypto.createHmac('sha1', config.authToken)
  hmac.update(data)
  const expectedSignature = hmac.digest('base64')

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

// ════════════════════════════════════════════════════════════════
// PHONE NUMBER NORMALIZATION
// ════════════════════════════════════════════════════════════════

/**
 * Extract E.164 phone number from Twilio WhatsApp format.
 * "whatsapp:+33612345678" → "+33612345678"
 */
export function extractPhoneE164(twilioFrom: string): string {
  return twilioFrom.replace('whatsapp:', '')
}

/**
 * Format phone number for Twilio WhatsApp.
 * "+33612345678" → "whatsapp:+33612345678"
 */
export function formatWhatsAppTo(phoneE164: string): string {
  return `whatsapp:${phoneE164}`
}

// ════════════════════════════════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════════════════════════════════

/**
 * Send a WhatsApp message via Twilio API.
 */
export async function sendWhatsAppMessage(message: OutboundMessage): Promise<SendResult> {
  const config = getTwilioConfig()

  if (!config.accountSid || !config.authToken || !config.whatsappNumber) {
    console.error('[Twilio] Missing configuration')
    return { success: false, error: 'Twilio not configured' }
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`

  const formData = new URLSearchParams()
  formData.append('From', formatWhatsAppTo(config.whatsappNumber))
  formData.append('To', formatWhatsAppTo(message.to))
  formData.append('Body', message.body)

  // If using a template
  if (message.templateSid) {
    formData.append('ContentSid', message.templateSid)
    if (message.templateVariables) {
      formData.append('ContentVariables', JSON.stringify(message.templateVariables))
    }
  }

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    })

    const data = await response.json()

    if (response.ok) {
      console.log(`[Twilio] Message sent: ${data.sid}`)
      return { success: true, messageSid: data.sid }
    } else {
      console.error('[Twilio] Send failed:', data)
      return { success: false, error: data.message || 'Send failed' }
    }
  } catch (error) {
    console.error('[Twilio] Request error:', error)
    return { success: false, error: String(error) }
  }
}

/**
 * Send a simple text message (convenience wrapper).
 */
export async function sendWhatsAppText(phoneE164: string, text: string): Promise<SendResult> {
  return sendWhatsAppMessage({ to: phoneE164, body: text })
}

// ════════════════════════════════════════════════════════════════
// PARSE INBOUND WEBHOOK
// ════════════════════════════════════════════════════════════════

/**
 * Parse Twilio inbound webhook payload from form data.
 */
export function parseTwilioPayload(formData: FormData): TwilioInboundPayload | null {
  const messageSid = formData.get('MessageSid')
  const accountSid = formData.get('AccountSid')
  const from = formData.get('From')
  const to = formData.get('To')
  const body = formData.get('Body')

  if (!messageSid || !from || !to || body === null) {
    return null
  }

  return {
    MessageSid: String(messageSid),
    AccountSid: String(accountSid || ''),
    From: String(from),
    To: String(to),
    Body: String(body),
    NumMedia: String(formData.get('NumMedia') || '0'),
    ProfileName: String(formData.get('ProfileName') || ''),
  }
}

/**
 * Parse Twilio payload from JSON body (alternative format).
 */
export function parseTwilioPayloadJson(body: Record<string, unknown>): TwilioInboundPayload | null {
  const messageSid = body.MessageSid
  const from = body.From
  const to = body.To
  const bodyText = body.Body

  if (!messageSid || !from || !to || bodyText === undefined) {
    return null
  }

  return {
    MessageSid: String(messageSid),
    AccountSid: String(body.AccountSid || ''),
    From: String(from),
    To: String(to),
    Body: String(bodyText),
    NumMedia: String(body.NumMedia || '0'),
    ProfileName: String(body.ProfileName || ''),
  }
}
