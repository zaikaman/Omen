import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const supabaseClientConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1).nullable().optional(),
  serviceRoleKey: z.string().min(1).nullable().optional(),
  schema: z.string().min(1).default("public"),
});

export type SupabaseClientConfig = z.infer<typeof supabaseClientConfigSchema>;

export type OmenSupabaseClient = ReturnType<typeof createClient>;

const createBaseClient = (input: {
  url: string;
  key: string;
}): OmenSupabaseClient =>
  createClient(input.url, input.key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

export const createSupabaseClient = (
  config: SupabaseClientConfig,
): OmenSupabaseClient => {
  const parsed = supabaseClientConfigSchema.parse(config);

  if (!parsed.anonKey) {
    throw new Error("anonKey is required to create a public Supabase client");
  }

  return createBaseClient({
    url: parsed.url,
    key: parsed.anonKey,
  });
};

export const createSupabaseServiceRoleClient = (
  config: SupabaseClientConfig,
): OmenSupabaseClient => {
  const parsed = supabaseClientConfigSchema.parse(config);

  if (!parsed.serviceRoleKey) {
    throw new Error("serviceRoleKey is required to create a service-role Supabase client");
  }

  return createBaseClient({
    url: parsed.url,
    key: parsed.serviceRoleKey,
  });
};

export const getSupabaseClientConfigFromEnv = (env: Record<string, string | undefined>) =>
  supabaseClientConfigSchema.parse({
    url: env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey:
      env.SUPABASE_ANON_KEY ??
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      env.SUPABASE_SERVICE_ROLE_KEY ??
      env.SUPABASE_SERVICE_KEY ??
      null,
    serviceRoleKey:
      env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY ?? null,
    schema: env.SUPABASE_SCHEMA ?? "public",
  });
