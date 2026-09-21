import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env ?? {};
const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!)
  : null;
