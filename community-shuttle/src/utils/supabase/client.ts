// src/utils/supabase/client.ts
// Browser-side Supabase client.
// Import this in any Client Component ("use client") that needs
// to read from or write to the database.

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}