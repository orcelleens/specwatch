import { z } from "zod";

/**
 * Environment variable schema for the application.
 * This schema is used to validate and type-check the environment variables.
 */
const envSchema = z.object({
  // Clerk configuration
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/dashboard"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/dashboard"),

  // Supabase configuration (for database/storage only, not auth)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Application URL
  APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // Logging
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  // Email (Resend)
  RESEND_API_KEY: z.string().min(1),

  // Billing (Polar)
  POLAR_ACCESS_TOKEN: z.string().min(1),

  // Optional: Feature flags
  ENABLE_EMAIL_NOTIFICATIONS: z
    .string()
    .default("true")
    .transform((val) => val === "true"),
});

/**
 * Load and validate environment variables.
 * @returns The validated configuration object.
 */
export function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  return parsed.data;
}

/**
 * Type for the configuration object.
 */
export type Config = z.infer<typeof envSchema>;

// Load and export the configuration as a singleton
export const config = loadConfig();