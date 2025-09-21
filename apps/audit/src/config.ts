import { z } from 'zod'

const configSchema = z.object({
  // Server configuration
  PORT: z.coerce.number().default(7080),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // Azure Table Storage configuration
  AUDIT_TABLE_CONNECTION_STRING: z.string().min(1),
  AUDIT_TABLE_NAME: z.string().min(1).default('audit_events'),

  // Authentication configuration (MVP - internal token)
  AUDIT_TOKEN: z.string().min(1),

  // JWT authentication for public endpoints
  APP_SECRET: z.string().min(1),

  // CORS configuration (comma-separated origins)
  AUDIT_CORS_ORIGINS: z.string().default('https://assessment.klicker.com'),

  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
})

export type Config = z.infer<typeof configSchema>

// Parse configuration once on module load to fail fast
export const config = configSchema.parse(process.env)
