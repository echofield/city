/**
 * FLOW FRONTEND CONFIGURATION
 */

export const CONFIG = {
  /**
   * Stripe payment link for subscription
   */
  STRIPE_PAYMENT_LINK: 'https://buy.stripe.com/14AfZhdha0XLfXG2kV48009',

  /**
   * Use the backend API for FlowState instead of local engine.
   */
  USE_API: import.meta.env.VITE_USE_API === 'true',

  /**
   * API base URL (empty for same-origin)
   */
  API_URL: import.meta.env.VITE_API_URL ?? '',

  /**
   * City ID for API requests
   */
  CITY_ID: import.meta.env.VITE_CITY_ID ?? 'paris',

  /**
   * FlowState refresh interval in ms
   */
  REFRESH_INTERVAL: 60000,

  /**
   * Enable debug logging
   */
  DEBUG: import.meta.env.DEV,
}
