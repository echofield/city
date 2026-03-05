/**
 * Opt-in State Machine — v1.6
 *
 * Handles numeric input from drivers and returns appropriate response.
 * State transitions based on single-digit or double-digit codes.
 *
 * Main menu:
 *   1 = Opt-in
 *   2 = Opt-out (decline)
 *   3 = Settings
 *   4 = Example
 *   0 = STOP
 *
 * Settings submenu:
 *   31 = Toggle Nord
 *   32 = Toggle Est
 *   33 = Toggle Sud
 *   34 = Toggle Ouest
 *   35 = Time 22h-02h
 *   36 = Time 00h-05h
 *   37 = Time all
 *   39 = Back to main
 */

import {
  getOrCreateSubscription,
  updateSubscriptionStatus,
  toggleCorridorPreference,
  setTimeWindowPreference,
  updateMenuState,
} from './subscription-manager'

import {
  MENU_MAIN,
  CONFIRM_OPT_IN,
  CONFIRM_OPT_OUT,
  CONFIRM_STOP,
  MENU_SETTINGS,
  confirmCorridorToggle,
  confirmTimeWindow,
  EXAMPLE_ALERT,
  MSG_UNKNOWN_INPUT,
  MSG_ALREADY_OPTED_IN,
} from './copy-fr'

import type { CorridorPreference } from './types'

// ════════════════════════════════════════════════════════════════
// STATE MACHINE RESULT
// ════════════════════════════════════════════════════════════════

export interface StateMachineResult {
  response: string
  newMenuState: 'main' | 'settings' | 'example'
  statusChanged: boolean
  newStatus?: 'opted_in' | 'opted_out'
}

// ════════════════════════════════════════════════════════════════
// PROCESS INPUT
// ════════════════════════════════════════════════════════════════

/**
 * Process numeric input from a driver.
 * Returns the response message and any state changes.
 */
export async function processNumericInput(
  phoneE164: string,
  input: string
): Promise<StateMachineResult> {
  // Normalize input: trim whitespace, extract digits
  const normalizedInput = input.trim().replace(/\D/g, '')

  // Get or create subscription
  const sub = await getOrCreateSubscription(phoneE164)
  const currentMenu = sub.last_menu_state || 'main'

  // Handle based on input code
  switch (normalizedInput) {
    // ══════════════════════════════════════════════════════════════
    // MAIN MENU COMMANDS
    // ══════════════════════════════════════════════════════════════

    case '1': // OPT-IN
      if (sub.status === 'opted_in') {
        return {
          response: MSG_ALREADY_OPTED_IN,
          newMenuState: 'main',
          statusChanged: false,
        }
      }
      await updateSubscriptionStatus(phoneE164, 'opted_in')
      await updateMenuState(phoneE164, 'main')
      return {
        response: CONFIRM_OPT_IN,
        newMenuState: 'main',
        statusChanged: true,
        newStatus: 'opted_in',
      }

    case '2': // DECLINE (soft opt-out, they never opted in)
      await updateSubscriptionStatus(phoneE164, 'opted_out')
      await updateMenuState(phoneE164, 'main')
      return {
        response: CONFIRM_OPT_OUT,
        newMenuState: 'main',
        statusChanged: true,
        newStatus: 'opted_out',
      }

    case '3': // SETTINGS
      await updateMenuState(phoneE164, 'settings')
      return {
        response: MENU_SETTINGS,
        newMenuState: 'settings',
        statusChanged: false,
      }

    case '4': // EXAMPLE
      await updateMenuState(phoneE164, 'example')
      return {
        response: EXAMPLE_ALERT,
        newMenuState: 'example',
        statusChanged: false,
      }

    case '0': // STOP
      await updateSubscriptionStatus(phoneE164, 'opted_out')
      await updateMenuState(phoneE164, 'main')
      return {
        response: CONFIRM_STOP,
        newMenuState: 'main',
        statusChanged: true,
        newStatus: 'opted_out',
      }

    // ══════════════════════════════════════════════════════════════
    // SETTINGS SUBMENU COMMANDS
    // ══════════════════════════════════════════════════════════════

    case '31': // Toggle Nord
      return await handleCorridorToggle(phoneE164, 'nord')

    case '32': // Toggle Est
      return await handleCorridorToggle(phoneE164, 'est')

    case '33': // Toggle Sud
      return await handleCorridorToggle(phoneE164, 'sud')

    case '34': // Toggle Ouest
      return await handleCorridorToggle(phoneE164, 'ouest')

    case '35': // Time 22h-02h
      await setTimeWindowPreference(phoneE164, '22h-02h')
      return {
        response: confirmTimeWindow('22h-02h') + '\n\n' + MENU_SETTINGS,
        newMenuState: 'settings',
        statusChanged: false,
      }

    case '36': // Time 00h-05h
      await setTimeWindowPreference(phoneE164, '00h-05h')
      return {
        response: confirmTimeWindow('00h-05h') + '\n\n' + MENU_SETTINGS,
        newMenuState: 'settings',
        statusChanged: false,
      }

    case '37': // Time all
      await setTimeWindowPreference(phoneE164, 'all')
      return {
        response: confirmTimeWindow('all') + '\n\n' + MENU_SETTINGS,
        newMenuState: 'settings',
        statusChanged: false,
      }

    case '39': // Back to main
      await updateMenuState(phoneE164, 'main')
      return {
        response: MENU_MAIN,
        newMenuState: 'main',
        statusChanged: false,
      }

    // ══════════════════════════════════════════════════════════════
    // UNKNOWN INPUT
    // ══════════════════════════════════════════════════════════════

    default:
      // If in settings, show settings menu
      if (currentMenu === 'settings') {
        return {
          response: MSG_UNKNOWN_INPUT + '\n\n' + MENU_SETTINGS,
          newMenuState: 'settings',
          statusChanged: false,
        }
      }
      // Otherwise show main menu
      return {
        response: MSG_UNKNOWN_INPUT,
        newMenuState: 'main',
        statusChanged: false,
      }
  }
}

/**
 * Handle corridor toggle.
 */
async function handleCorridorToggle(
  phoneE164: string,
  corridor: CorridorPreference
): Promise<StateMachineResult> {
  const { enabled } = await toggleCorridorPreference(phoneE164, corridor)

  return {
    response: confirmCorridorToggle(corridor, enabled) + '\n\n' + MENU_SETTINGS,
    newMenuState: 'settings',
    statusChanged: false,
  }
}

// ════════════════════════════════════════════════════════════════
// FIRST CONTACT
// ════════════════════════════════════════════════════════════════

/**
 * Handle first contact from a new driver.
 * Always send the main opt-in menu.
 */
export async function handleFirstContact(phoneE164: string): Promise<string> {
  await getOrCreateSubscription(phoneE164)
  await updateMenuState(phoneE164, 'main')
  return MENU_MAIN
}

/**
 * Check if this is a first contact (no previous messages).
 */
export async function isFirstContact(phoneE164: string): Promise<boolean> {
  const sub = await getOrCreateSubscription(phoneE164)
  // If status is still pending and no opted_in_at, it's first contact
  return sub.status === 'pending' && !sub.opted_in_at && !sub.opted_out_at
}
