import { z } from 'zod'

const configSchema = z.object({
  // Server configuration
  PORT: z.coerce.number().default(7080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Azure Table Storage configuration
  AZURE_TABLES_CONNECTION_STRING: z.string().min(1),
  AZURE_TABLES_TABLE_NAME: z.string().min(1).default('audit_events'),
  
  // Authentication configuration (MVP - internal token)
  INTERNAL_TOKEN: z.string().min(1),
  
  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  
  // Service configuration
  SERVICE_NAME: z.string().default('audit-service'),
  SERVICE_VERSION: z.string().default('1.0.0'),
})

export type Config = z.infer<typeof configSchema>

// Parse configuration once on module load to fail fast
export const config = configSchema.parse(process.env)