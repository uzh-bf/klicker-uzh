import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'

const MAX_DATABASE_INT = 2_147_483_647
const SEMESTER_KEY_PATTERN = /^\d{4}-(?:H1|H2)$/
const CURRENCY_PATTERN = /^[A-Z]{3}$/

export const KB_GRAPH_COST_CURRENCY_DEFAULT = 'CHF'
export const KB_GRAPH_BILLING_MODE_DEFAULT = 'SEMESTER_QUOTA'
export const KB_GRAPH_PRICING_VERSION_DEFAULT = 'unconfigured'

export type KBGraphBillingMode = 'SEMESTER_QUOTA' | 'PROVIDER_BILLED'

export type KBGraphCostConfiguration = {
  currency: string
  standardEstimateMinorUnits: number | null
  highEstimateMinorUnits: number | null
  maxCostMinorUnits: number | null
  semesterQuotaMinorUnits: number | null
  pricingVersion: string
  billingMode: KBGraphBillingMode
  semesterKey: string
  ready: boolean
}

function parseMinorUnits(env: NodeJS.ProcessEnv, name: string): number | null {
  const value = env[name]?.trim()
  if (value === undefined || value === '') return null
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed > MAX_DATABASE_INT) {
    throw new Error(`${name} is outside the supported range`)
  }
  return parsed
}

function requirePositive(value: number | null, name: string): number {
  if (value === null || value === 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

function parseCurrency(env: NodeJS.ProcessEnv): string {
  const currency =
    env.KB_GRAPH_COST_CURRENCY?.trim() ?? KB_GRAPH_COST_CURRENCY_DEFAULT
  if (!CURRENCY_PATTERN.test(currency)) {
    throw new Error(
      'KB_GRAPH_COST_CURRENCY must be a three-letter uppercase code'
    )
  }
  return currency
}

function parsePricingVersion(env: NodeJS.ProcessEnv): string {
  const pricingVersion =
    env.KB_GRAPH_COST_PRICING_VERSION?.trim() ??
    KB_GRAPH_PRICING_VERSION_DEFAULT
  if (!/^[A-Za-z0-9._-]{1,100}$/.test(pricingVersion)) {
    throw new Error('KB_GRAPH_COST_PRICING_VERSION is invalid')
  }
  return pricingVersion
}

function parseBillingMode(env: NodeJS.ProcessEnv): KBGraphBillingMode {
  const billingMode =
    env.KB_GRAPH_BILLING_MODE?.trim() ?? KB_GRAPH_BILLING_MODE_DEFAULT
  if (billingMode !== 'SEMESTER_QUOTA' && billingMode !== 'PROVIDER_BILLED') {
    throw new Error(
      'KB_GRAPH_BILLING_MODE must be SEMESTER_QUOTA or PROVIDER_BILLED'
    )
  }
  return billingMode
}

export function getKBGraphSemesterKey(
  now: Date = new Date(),
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured = env.KB_GRAPH_SEMESTER_KEY?.trim()
  if (configured !== undefined && !SEMESTER_KEY_PATTERN.test(configured)) {
    throw new Error('KB_GRAPH_SEMESTER_KEY must use YYYY-H1 or YYYY-H2')
  }
  if (configured) return configured

  const half = now.getUTCMonth() < 6 ? 'H1' : 'H2'
  return `${now.getUTCFullYear()}-${half}`
}

export function getKBGraphCostConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date()
): KBGraphCostConfiguration {
  const standardEstimateMinorUnits = parseMinorUnits(
    env,
    'KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS'
  )
  const highEstimateMinorUnits = parseMinorUnits(
    env,
    'KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS'
  )
  const maxCostMinorUnits = parseMinorUnits(
    env,
    'KB_GRAPH_MAX_COST_MINOR_UNITS'
  )
  const semesterQuotaMinorUnits = parseMinorUnits(
    env,
    'KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS'
  )

  if (
    maxCostMinorUnits !== null &&
    standardEstimateMinorUnits !== null &&
    standardEstimateMinorUnits > maxCostMinorUnits
  ) {
    throw new Error(
      'KB_GRAPH_MAX_COST_MINOR_UNITS must cover the standard estimate'
    )
  }
  if (
    maxCostMinorUnits !== null &&
    highEstimateMinorUnits !== null &&
    highEstimateMinorUnits > maxCostMinorUnits
  ) {
    throw new Error(
      'KB_GRAPH_MAX_COST_MINOR_UNITS must cover the high estimate'
    )
  }

  return {
    currency: parseCurrency(env),
    standardEstimateMinorUnits,
    highEstimateMinorUnits,
    maxCostMinorUnits,
    semesterQuotaMinorUnits,
    pricingVersion: parsePricingVersion(env),
    billingMode: parseBillingMode(env),
    semesterKey: getKBGraphSemesterKey(now, env),
    ready: [
      standardEstimateMinorUnits,
      highEstimateMinorUnits,
      maxCostMinorUnits,
      semesterQuotaMinorUnits,
    ].every((value) => value !== null && value > 0),
  }
}

export function requireKBGraphCostConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date()
) {
  const config = getKBGraphCostConfiguration(env, now)
  if (!config.ready) {
    throw new GraphQLError('KB graph cost configuration is incomplete', {
      extensions: { code: 'KB_GRAPH_COST_CONFIGURATION_MISSING' },
    })
  }

  return {
    ...config,
    standardEstimateMinorUnits: requirePositive(
      config.standardEstimateMinorUnits,
      'KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS'
    ),
    highEstimateMinorUnits: requirePositive(
      config.highEstimateMinorUnits,
      'KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS'
    ),
    maxCostMinorUnits: requirePositive(
      config.maxCostMinorUnits,
      'KB_GRAPH_MAX_COST_MINOR_UNITS'
    ),
    semesterQuotaMinorUnits: requirePositive(
      config.semesterQuotaMinorUnits,
      'KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS'
    ),
  }
}

export function getKBGraphEstimate(
  qualityTier: DB.KBGraphQualityTier,
  config: KBGraphCostConfiguration
): number | null {
  return qualityTier === DB.KBGraphQualityTier.HIGH
    ? config.highEstimateMinorUnits
    : config.standardEstimateMinorUnits
}

export function getKBGraphBillingLabel(
  config: KBGraphCostConfiguration
): string {
  return config.billingMode === 'PROVIDER_BILLED'
    ? 'PROVIDER_BILLED'
    : 'SEMESTER_QUOTA'
}
