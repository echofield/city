/**
 * Database types for City Flow Intelligence
 * Uses Supabase standard schema structure
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Profile preferences (legacy)
export interface ProfilePreferences {
  shift: 'morning' | 'afternoon' | 'night'
  zones: string[]
  traffic_tolerance: 'low' | 'medium' | 'high'
  trip_type: 'short' | 'long' | 'airports' | 'business' | 'mixed'
  driving_style: 'safe' | 'balanced' | 'chase'
  strategy: 'min_dead_km' | 'max_euro_h' | 'balanced'
}

// Intelligent Profile State (FLOW engine)
export type ProfileVariant =
  | 'NIGHT_CHASER'
  | 'SAFE_STEADY'
  | 'AIRPORT_LONG'
  | 'EAST_NIGHTLIFE'
  | 'WEST_BUSINESS'
  | 'BALANCED'

export interface ProfileWeights {
  nightlife: number
  events_big: number
  micro_events: number
  commute: number
  airport: number
  business: number
  rain_uplift: number
  friction_avoidance: number
  dead_km_penalty: number
  saturation_penalty: number
}

export interface ProfileState {
  variant: ProfileVariant
  weights: ProfileWeights
  constraints: {
    preferred_areas: string[]
    avoid_areas: string[]
    shift_window: { start: string; end: string }
    traffic_tolerance: 'LOW' | 'MED' | 'HIGH'
  }
  calibrated_at: string
  confidence: number
}

// Brief content structure
export interface BriefContent {
  summary: string[]
  timeline: {
    window: string
    zones: string[]
    alternatives: string[]
    saturation: 'low' | 'medium' | 'high'
  }[]
  hotspots: {
    zone: string
    window: string
    saturation_risk: 'low' | 'medium' | 'high'
    alternatives: string[]
    waze_link?: string
  }[]
  alerts: {
    type: 'manifestation' | 'travaux' | 'event' | 'meteo'
    title: string
    description: string
    zones: string[]
    window?: string
  }[]
  rules: {
    condition: string
    action: string
  }[]
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          preferences: ProfilePreferences | null
          profile_state: ProfileState | null // FLOW intelligent profile
          onboarding_complete: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          preferences?: ProfilePreferences | null
          profile_state?: ProfileState | null
          onboarding_complete?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          preferences?: ProfilePreferences | null
          profile_state?: ProfileState | null
          onboarding_complete?: boolean
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan_id: string
          status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
          current_period_start: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan_id: string
          status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
          current_period_start?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan_id?: string
          status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete'
          current_period_start?: string | null
          current_period_end?: string | null
          updated_at?: string
        }
      }
      plan_catalog: {
        Row: {
          id: string
          name: string
          price: number
          currency: string
          interval: 'month' | 'year'
          stripe_price_id: string | null
          features: string[]
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          price: number
          currency?: string
          interval?: 'month' | 'year'
          stripe_price_id?: string | null
          features?: string[]
          is_active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          price?: number
          currency?: string
          interval?: 'month' | 'year'
          stripe_price_id?: string | null
          features?: string[]
          is_active?: boolean
        }
      }
      briefs: {
        Row: {
          id: string
          user_id: string
          date: string
          type: 'daily' | 'weekly'
          content_json: BriefContent
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          type: 'daily' | 'weekly'
          content_json: BriefContent
          created_at?: string
        }
        Update: {
          date?: string
          type?: 'daily' | 'weekly'
          content_json?: BriefContent
        }
      }
      alerts: {
        Row: {
          id: string
          user_id: string
          type: 'manifestation' | 'travaux' | 'event' | 'meteo' | 'system'
          title: string
          description: string
          zones: string[]
          severity: 'info' | 'warning' | 'critical'
          active: boolean
          valid_from: string | null
          valid_until: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'manifestation' | 'travaux' | 'event' | 'meteo' | 'system'
          title: string
          description: string
          zones?: string[]
          severity?: 'info' | 'warning' | 'critical'
          active?: boolean
          valid_from?: string | null
          valid_until?: string | null
          created_at?: string
        }
        Update: {
          type?: 'manifestation' | 'travaux' | 'event' | 'meteo' | 'system'
          title?: string
          description?: string
          zones?: string[]
          severity?: 'info' | 'warning' | 'critical'
          active?: boolean
          valid_from?: string | null
          valid_until?: string | null
        }
      }
      referral_accounts: {
        Row: {
          id: string
          user_id: string
          referral_code: string
          total_referrals: number
          successful_referrals: number
          credits_earned: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          referral_code: string
          total_referrals?: number
          successful_referrals?: number
          credits_earned?: number
          created_at?: string
        }
        Update: {
          referral_code?: string
          total_referrals?: number
          successful_referrals?: number
          credits_earned?: number
        }
      }
      referrals: {
        Row: {
          id: string
          referrer_id: string
          referred_id: string | null
          referred_email: string
          status: 'pending' | 'signed_up' | 'subscribed' | 'credited'
          created_at: string
          converted_at: string | null
        }
        Insert: {
          id?: string
          referrer_id: string
          referred_id?: string | null
          referred_email: string
          status?: 'pending' | 'signed_up' | 'subscribed' | 'credited'
          created_at?: string
          converted_at?: string | null
        }
        Update: {
          referred_id?: string | null
          status?: 'pending' | 'signed_up' | 'subscribed' | 'credited'
          converted_at?: string | null
        }
      }
      // FLOW Intelligence Engine tables
      driver_feedback: {
        Row: {
          id: string
          user_id: string
          brief_id: string
          rating: number // 1 = helped, 0 = neutral, -1 = not useful
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          brief_id: string
          rating: number
          note?: string | null
          created_at?: string
        }
        Update: {
          rating?: number
          note?: string | null
        }
      }
      brief_runs: {
        Row: {
          id: string
          run_mode: 'daily' | 'weekly' | 'intraday_alert'
          horizon: '24h' | '7d'
          profiles_processed: number
          briefs_generated: number
          model: string
          tokens_used: number
          confidence_avg: number
          started_at: string
          completed_at: string | null
          errors: string[]
        }
        Insert: {
          id?: string
          run_mode: 'daily' | 'weekly' | 'intraday_alert'
          horizon: '24h' | '7d'
          profiles_processed?: number
          briefs_generated?: number
          model?: string
          tokens_used?: number
          confidence_avg?: number
          started_at?: string
          completed_at?: string | null
          errors?: string[]
        }
        Update: {
          profiles_processed?: number
          briefs_generated?: number
          tokens_used?: number
          confidence_avg?: number
          completed_at?: string | null
          errors?: string[]
        }
      }
      source_items: {
        Row: {
          id: string
          pack_date: string
          horizon: '24h' | '7d'
          content_json: Json
          sources_count: number
          generated_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          pack_date: string
          horizon: '24h' | '7d'
          content_json: Json
          sources_count?: number
          generated_at?: string
          expires_at?: string
        }
        Update: {
          content_json?: Json
          sources_count?: number
          expires_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Subscription = Database['public']['Tables']['subscriptions']['Row']
export type Plan = Database['public']['Tables']['plan_catalog']['Row']
export type Brief = Database['public']['Tables']['briefs']['Row']
export type Alert = Database['public']['Tables']['alerts']['Row']
export type ReferralAccount = Database['public']['Tables']['referral_accounts']['Row']
export type Referral = Database['public']['Tables']['referrals']['Row']

// FLOW Intelligence Engine types
export type DriverFeedback = Database['public']['Tables']['driver_feedback']['Row']
export type BriefRun = Database['public']['Tables']['brief_runs']['Row']
export type SourceItem = Database['public']['Tables']['source_items']['Row']
