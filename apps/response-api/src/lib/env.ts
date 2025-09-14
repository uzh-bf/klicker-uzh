import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.coerce.number().default(7078),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    ),
  APP_SECRET: z.string(),
  ASSESSMENT_MODE: z
    .union([z.literal('true'), z.literal('false')])
    .default('false')
    .transform((v) => v === 'true'),
  LOG_LEVEL: z
    .enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .optional()
    .default('info'),
  CORRELATION_HASH_ALGO: z
    .enum(['md5', 'hmac-sha256'])
    .optional()
    .default('md5'),
  APP_SECRETS_PREVIOUS: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    ),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASS: z.string().optional(),
  REDIS_TLS: z.string().optional(),
})

export type Env = z.infer<typeof EnvSchema>

export const env: Env = EnvSchema.parse(process.env)
