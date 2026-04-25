import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export const supabaseClientConfigSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
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
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? null,
    schema: env.SUPABASE_SCHEMA ?? "public",
  });
