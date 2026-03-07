/**
 * FLOW FRONTEND CONFIGURATION
 *
 * Feature flags and environment configuration.
 */

export const CONFIG = {
  /**
   * Use the backend API for FlowState instead of local engine.
   * Set to true once the API is deployed and tested.
   */
  USE_API: import.meta.env.VITE_USE_API === 'true',

  /**
   * Stripe payment link for subscription
   */
  STRIPE_PAYMENT_LINK: 'https://buy.stripe.com/14AfZhdha0XLfXG2kV48009',

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
  REFRESH_INTERVAL: 60000, // 1 minute

  /**
   * SNCF train data refresh interval in ms
   */
  SNCF_REFRESH_INTERVAL: 90000, // 90 seconds

  /**
   * Enable debug logging
   */
  DEBUG: import.meta.env.DEV,
}
