import { createLocalService } from './local/service';
import type { DataService } from './service';
import { isSupabaseConfigured } from './supabase/client';
import { createSupabaseService } from './supabase/service';

/**
 * Supabase when EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are set,
 * otherwise the on-device demo backend with sample data.
 */
export const api: DataService = isSupabaseConfigured ? createSupabaseService() : createLocalService();

export * from './service';
export * from './types';
