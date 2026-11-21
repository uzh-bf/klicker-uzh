import { KBGraphQualityTier } from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import { describe, expect, it } from 'vitest'
import {
  getKBGraphCostConfiguration,
  getKBGraphEstimate,
  getKBGraphSemesterKey,
  requireKBGraphCostConfiguration,
} from '../src/services/knowledgeGraphCost.js'

const configuredEnv = {
  KB_GRAPH_COST_CURRENCY: 'CHF',
  KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '100',
  KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS: '200',
  KB_GRAPH_MAX_COST_MINOR_UNITS: '250',
  KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '1000',
  KB_GRAPH_COST_PRICING_VERSION: '2026-08',
  KB_GRAPH_BILLING_MODE: 'SEMESTER_QUOTA',
  KB_GRAPH_SEMESTER_KEY: '2026-H2',
}

describe('knowledge graph cost configuration', () => {
  it('fails closed when monetary configuration is absent', () => {
    const config = getKBGraphCostConfiguration(
      {},
      new Date('2026-08-15T00:00:00.000Z')
    )

    expect(config.ready).toBe(false)
    expect(config.currency).toBe('CHF')
    expect(config.semesterKey).toBe('2026-H2')
  })

  it('reads integer minor-unit limits and tier estimates', () => {
    const config = getKBGraphCostConfiguration(configuredEnv)

    expect(config).toMatchObject({
      ready: true,
      standardEstimateMinorUnits: 100,
      highEstimateMinorUnits: 200,
      maxCostMinorUnits: 250,
      semesterQuotaMinorUnits: 1000,
      semesterKey: '2026-H2',
    })
    expect(getKBGraphEstimate(KBGraphQualityTier.STANDARD, config)).toBe(100)
    expect(getKBGraphEstimate(KBGraphQualityTier.HIGH, config)).toBe(200)
  })

  it('does not expose zero-value monetary settings as ready', () => {
    const config = getKBGraphCostConfiguration({
      ...configuredEnv,
      KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '0',
    })

    expect(config.ready).toBe(false)
    expect(() => requireKBGraphCostConfiguration(configuredEnv)).not.toThrow()
    expect(() =>
      requireKBGraphCostConfiguration({
        ...configuredEnv,
        KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '0',
      })
    ).toThrow(GraphQLError)
  })

  it('rejects a maximum below a configured tier estimate', () => {
    expect(() =>
      getKBGraphCostConfiguration({
        ...configuredEnv,
        KB_GRAPH_MAX_COST_MINOR_UNITS: '99',
      })
    ).toThrow('must cover the standard estimate')
  })

  it('rejects malformed semester keys', () => {
    expect(() =>
      getKBGraphSemesterKey(new Date('2026-08-15T00:00:00.000Z'), {
        KB_GRAPH_SEMESTER_KEY: '2026-fall',
      })
    ).toThrow('YYYY-H1 or YYYY-H2')
  })

  it('requires a complete configuration before reservation', () => {
    expect(() => requireKBGraphCostConfiguration({})).toThrow(GraphQLError)
    expect(() => requireKBGraphCostConfiguration(configuredEnv)).not.toThrow()
  })
})
