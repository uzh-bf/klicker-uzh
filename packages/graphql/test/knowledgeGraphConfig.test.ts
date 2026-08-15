import {
  KBGraphBuildStatus,
  KBGraphQualityTier,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import { getKBGraphBuildConfig } from '../src/services/knowledge.js'
import { getKBGraphCostConfiguration } from '../src/services/knowledgeGraphCost.js'

const costEnv = {
  KB_GRAPH_COST_CURRENCY: 'CHF',
  KB_GRAPH_STANDARD_ESTIMATE_MINOR_UNITS: '100',
  KB_GRAPH_HIGH_ESTIMATE_MINOR_UNITS: '200',
  KB_GRAPH_MAX_COST_MINOR_UNITS: '250',
  KB_GRAPH_SEMESTER_QUOTA_MINOR_UNITS: '1000',
  KB_GRAPH_COST_PRICING_VERSION: 'test-v1',
  KB_GRAPH_SEMESTER_KEY: '2026-H2',
}

const build: Parameters<typeof getKBGraphBuildConfig>[1] = {
  id: '11111111-1111-4111-8111-111111111111',
  status: KBGraphBuildStatus.SUCCEEDED,
  statusMessage: null,
  qualityTier: KBGraphQualityTier.STANDARD,
  sourceContentDigest: 'source-digest',
  startedAt: null,
  finishedAt: null,
  createdAt: new Date('2026-08-15T00:00:00.000Z'),
  updatedAt: new Date('2026-08-15T00:00:00.000Z'),
  estimatedCostMinorUnits: 100,
  actualCostMinorUnits: 60,
  actualInputTokens: 11,
  actualOutputTokens: 13,
  actualEmbeddingTokens: 7,
  actualRequestCount: 2,
  costCurrency: 'CHF',
  costStatus: null,
  quotaId: '22222222-2222-4222-8222-222222222222',
  quota: {
    currency: 'CHF',
    limitMinorUnits: 1000,
    reservedMinorUnits: 0,
    settledMinorUnits: 60,
  },
}

describe('KB knowledge graph config', () => {
  it('reports quota configuration drift and keeps quota currency separate', () => {
    const costConfiguration = getKBGraphCostConfiguration(costEnv)
    const result = getKBGraphBuildConfig(
      {
        id: '33333333-3333-4333-8333-333333333333',
        knowledgeGraphEnabled: true,
        activeGraphBuildId: null,
        publishedGraphBuildId: build.id,
      },
      {
        ...build,
        costCurrency: 'EUR',
      },
      false,
      {
        currency: 'USD',
        limitMinorUnits: 900,
        reservedMinorUnits: 100,
        settledMinorUnits: 50,
      },
      costConfiguration
    )

    expect(result.costConfigurationReady).toBe(false)
    expect(result.costCurrency).toBe('EUR')
    expect(result.quotaCurrency).toBe('USD')
    expect(result.remainingSemesterQuotaMinorUnits).toBe(750)
  })
})
