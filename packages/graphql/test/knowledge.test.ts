import {
  KBGraphInclusionMode,
  KBResourceKind,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import {
  isResourceIncludedInGraph,
  validateKBMetadata,
  validateKBRefreshPolicy,
  validateKBResourceMetadata,
  validateKBResourceSource,
} from '../src/services/knowledgeMetadata.js'
import {
  resolveIncomingKBWebhookIds,
  signKBWebhookPayload,
  verifyKBWebhookSignature,
} from '../src/services/knowledgeWebhooks.js'

describe('KB service helpers', () => {
  it('validates Klicker-owned KB and resource metadata profiles', () => {
    expect(
      validateKBMetadata('AI_BUDDY', {
        studyLevel: 'BOTH',
        scope: 'UZH_WIDE',
        audience: ['STUDENTS'],
        retrievalTags: ['semester-1'],
      })
    ).toEqual({
      studyLevel: 'BOTH',
      scope: 'UZH_WIDE',
      audience: ['STUDENTS'],
      retrievalTags: ['semester-1'],
    })

    expect(() =>
      validateKBResourceMetadata('COURSE_KB', { studyLevel: 'DIPLOMA' })
    ).toThrow('Invalid KB resource metadata')
  })

  it('validates fixed resource kind source fields', () => {
    expect(
      validateKBResourceSource({
        kind: KBResourceKind.WEBSITE,
        websiteUrl: 'https://www.uzh.ch/cmsssl/en.html',
        websiteStrategy: 'SCRAPE_SUBSITES',
      })
    ).toMatchObject({
      websiteUrl: 'https://www.uzh.ch/cmsssl/en.html',
      websiteStrategy: 'SCRAPE_SUBSITES',
    })

    expect(
      validateKBResourceSource({
        kind: KBResourceKind.SNIPPET,
        snippetText: 'A short source text.',
      })
    ).toMatchObject({
      snippetText: 'A short source text.',
    })

    expect(() =>
      validateKBResourceSource({
        kind: KBResourceKind.KLICKER_OBJECT,
        elementId: 1,
        practiceQuizId: '00000000-0000-0000-0000-000000000000',
      })
    ).toThrow('Exactly one Klicker object reference is required')
  })

  it('validates refresh policies and graph inclusion', () => {
    expect(
      validateKBRefreshPolicy({
        refreshIntervalMinutes: 60,
      })
    ).toEqual({
      refreshIntervalMinutes: 60,
    })

    expect(() =>
      validateKBRefreshPolicy({ refreshIntervalMinutes: 0 })
    ).toThrow('refreshIntervalMinutes must be greater than 0')

    expect(
      isResourceIncludedInGraph(
        {
          graphEnabled: true,
          graphResourceKinds: [KBResourceKind.DOCUMENT],
        },
        {
          kind: KBResourceKind.DOCUMENT,
          graphInclusion: KBGraphInclusionMode.INHERIT,
        }
      )
    ).toBe(true)

    expect(
      isResourceIncludedInGraph(
        {
          graphEnabled: true,
          graphResourceKinds: [KBResourceKind.DOCUMENT],
        },
        {
          kind: KBResourceKind.WEBSITE,
          graphInclusion: KBGraphInclusionMode.EXCLUDE,
        }
      )
    ).toBe(false)
  })

  it('signs and verifies webhook payloads', () => {
    const body = JSON.stringify({ resourceId: 'res-1' })
    const timestamp = String(Math.floor(Date.now() / 1000))
    const signature = signKBWebhookPayload({
      secret: 'secret',
      timestamp,
      rawBody: body,
    })

    expect(
      verifyKBWebhookSignature({
        secret: 'secret',
        timestamp,
        rawBody: body,
        signature,
        toleranceSeconds: 60,
      })
    ).toBe(true)

    expect(
      verifyKBWebhookSignature({
        secret: 'secret',
        timestamp,
        rawBody: body,
        signature: `${signature}0`,
        toleranceSeconds: 60,
      })
    ).toBe(false)
  })

  it('resolves incoming webhook ids from scoped payload objects', () => {
    expect(
      resolveIncomingKBWebhookIds({
        eventId: 'event-1',
        eventType: 'kb.metrics_updated',
        occurredAt: new Date().toISOString(),
        kb: { id: 'kb-1' },
      })
    ).toEqual({
      kbId: 'kb-1',
      resourceId: null,
      ingestionRunId: null,
    })

    expect(
      resolveIncomingKBWebhookIds({
        eventId: 'event-2',
        eventType: 'resource.processing_succeeded',
        occurredAt: new Date().toISOString(),
        kb: { id: 'kb-1' },
        resource: { id: 'resource-1' },
        ingestionRun: { id: 'run-1' },
      })
    ).toEqual({
      kbId: 'kb-1',
      resourceId: 'resource-1',
      ingestionRunId: 'run-1',
    })
  })
})
