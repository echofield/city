/**
 * POST /api/whatsapp/inbound — Twilio WhatsApp Webhook
 *
 * Receives inbound messages from drivers via Twilio.
 * Processes numeric opt-in commands and responds.
 *
 * Twilio sends form-urlencoded POST with:
 *   - From: "whatsapp:+33612345678"
 *   - Body: "1"
 *   - MessageSid: "SMxxxx"
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import {
  extractPhoneE164,
  sendWhatsAppText,
  isTwilioConfigured,
} from '@/lib/whatsapp/twilio-client'

import {
  processNumericInput,
  handleFirstContact,
  isFirstContact,
} from '@/lib/whatsapp/opt-in-state-machine'

import {
  logInboundMessage,
  markInboundProcessed,
} from '@/lib/whatsapp/subscription-manager'

// ════════════════════════════════════════════════════════════════
// WEBHOOK HANDLER
// ════════════════════════════════════════════════════════════════

export async function POST(request: Request) {
  try {
    // Check if Twilio is configured
    if (!isTwilioConfigured()) {
      console.warn('[WhatsApp] Twilio not configured')
      // Return 200 to prevent Twilio retries
      return new NextResponse('OK', { status: 200 })
    }

    // Parse form data (Twilio sends application/x-www-form-urlencoded)
    const contentType = request.headers.get('content-type') || ''
    let from: string | null = null
    let body: string | null = null
    let messageSid: string | null = null

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData()
      from = formData.get('From') as string | null
      body = formData.get('Body') as string | null
      messageSid = formData.get('MessageSid') as string | null
    } else if (contentType.includes('application/json')) {
      const json = await request.json()
      from = json.From
      body = json.Body
      messageSid = json.MessageSid
    }

    // Validate required fields
    if (!from || body === null) {
      console.error('[WhatsApp] Missing From or Body')
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Extract E.164 phone number
    const phoneE164 = extractPhoneE164(from)

    console.log(`[WhatsApp] Inbound from ${phoneE164}: "${body}"`)

    // Log inbound message
    const inboundLog = await logInboundMessage(phoneE164, body, messageSid)

    // Process the input
    let responseText: string

    // Check if first contact (new driver)
    const firstContact = await isFirstContact(phoneE164)
    if (firstContact && body.trim() === '') {
      // First message with empty body - send welcome menu
      responseText = await handleFirstContact(phoneE164)
    } else {
      // Process numeric input
      const result = await processNumericInput(phoneE164, body)
      responseText = result.response

      // Log status change if any
      if (result.statusChanged) {
        console.log(`[WhatsApp] ${phoneE164} status changed to: ${result.newStatus}`)
      }
    }

    // Send response via Twilio
    const sendResult = await sendWhatsAppText(phoneE164, responseText)

    if (sendResult.success) {
      // Mark inbound as processed
      await markInboundProcessed(inboundLog.id, responseText.slice(0, 100))
    } else {
      console.error(`[WhatsApp] Failed to send response: ${sendResult.error}`)
    }

    // Return TwiML response (empty is fine, we send via API)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      {
        status: 200,
        headers: {
          'Content-Type': 'application/xml',
        },
      }
    )
  } catch (error) {
    console.error('[WhatsApp] Webhook error:', error)
    // Return 200 to prevent Twilio retries
    return new NextResponse('OK', { status: 200 })
  }
}

// ════════════════════════════════════════════════════════════════
// HEALTH CHECK
// ════════════════════════════════════════════════════════════════

export async function GET() {
  const configured = isTwilioConfigured()

  return NextResponse.json({
    ok: true,
    webhook: '/api/whatsapp/inbound',
    provider: 'twilio',
    configured,
    hint: configured
      ? 'Webhook ready. Configure in Twilio console.'
      : 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_NUMBER',
  })
}
