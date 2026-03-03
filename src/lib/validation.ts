/**
 * Input validation schemas using Zod
 */

import { z } from 'zod'

// ══════════════════════════════════════════════════════════════
// FLOW STATE PARAMS
// ══════════════════════════════════════════════════════════════

export const flowStateParamsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  sessionStart: z.coerce.number().positive().optional(),
  zone: z.string().max(100).optional(),
  mock: z.enum(['0', '1']).optional(),
})

export type FlowStateParams = z.infer<typeof flowStateParamsSchema>

// ══════════════════════════════════════════════════════════════
// DISPATCH PARAMS
// ══════════════════════════════════════════════════════════════

export const dispatchParamsSchema = z.object({
  sessionStart: z.coerce.number().positive().optional(),
  courses: z.coerce.number().int().min(0).max(100).optional(),
  earnings: z.coerce.number().min(0).max(10000).optional(),
})

export type DispatchParams = z.infer<typeof dispatchParamsSchema>

// ══════════════════════════════════════════════════════════════
// CHECKOUT
// ══════════════════════════════════════════════════════════════

// List of valid Stripe price IDs (update when adding new plans)
const VALID_PRICE_IDS = [
  'price_flow_monthly_49',
  'price_flow_yearly_490',
  // Add your actual Stripe price IDs here
] as const

export const checkoutBodySchema = z.object({
  priceId: z.string().min(1).max(100),
  // Optional: validate against known IDs
  // priceId: z.enum(VALID_PRICE_IDS),
})

export type CheckoutBody = z.infer<typeof checkoutBodySchema>

// ══════════════════════════════════════════════════════════════
// SIMULATION REQUEST
// ══════════════════════════════════════════════════════════════

export const simulationRequestSchema = z.object({
  dailyPack: z.object({
    date: z.string(),
    generatedAt: z.string().optional(),
    events: z.array(z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      zoneImpact: z.array(z.string()).optional(),
    })).optional(),
    transport: z.array(z.any()).optional(),
    weather: z.array(z.any()).optional(),
  }),
  sessionStart: z.number().optional(),
  zone: z.string().optional(),
})

export type SimulationRequest = z.infer<typeof simulationRequestSchema>

// ══════════════════════════════════════════════════════════════
// HELPER
// ══════════════════════════════════════════════════════════════

/**
 * Parse and validate query params from URLSearchParams
 */
export function parseQueryParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  const obj: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    obj[key] = value
  })

  const result = schema.safeParse(obj)

  if (result.success) {
    return { success: true, data: result.data }
  }

  const errorMessages = result.error.issues
    .map(e => `${e.path.join('.')}: ${e.message}`)
    .join(', ')

  return { success: false, error: errorMessages }
}
