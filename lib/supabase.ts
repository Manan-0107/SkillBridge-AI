/**
 * Supabase client — single source of truth.
 *
 * When NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set
 * (e.g. local dev without credentials), every DB operation gracefully returns
 * null / empty arrays instead of crashing.
 *
 * Setup:
 *   1. Create a free project at https://supabase.com
 *   2. Copy Project URL and anon key to .env.local
 *   3. Run the SQL in lib/db.ts comments to create the tables
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured =
  supabaseUrl.startsWith("https://") && supabaseAnonKey.length > 10;

// Export a real client when configured, otherwise a typed stub that no-ops.
export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function isSupabaseReady(): boolean {
  return supabaseConfigured && supabase !== null;
}
