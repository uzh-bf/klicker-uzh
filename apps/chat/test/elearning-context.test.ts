import { signJWT, verifyElearningChatGrant } from '@klicker-uzh/util'
import {
  ELEARNING_SNAPSHOT_EXCERPT_MAX_LENGTH,
  ELEARNING_SNAPSHOT_OUTLINE_MAX_ITEMS,
} from '@klicker-uzh/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  formatElearningGroundingPolicy,
  hasElearningPageEvidence,
  isElearningOriginThread,
  normalizePersistedLearningContext,
  resolveElearningThreadOrigin,
  verifyAndNormalizeElearningChatContext,
} from '../src/services/elearningContext'

const SECRET = 'test-elearning-handoff-secret'
const CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const COURSE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const LEARNER_BINDING = 'learner-binding-1'

function longExcerpt(): string {
  return 'word '.repeat(220)
}

function baseSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    snapshotId: 'snap-1',
    observedAt: '2026-09-12T10:00:00Z',
    locale: 'de',
    location: {
      surface: 'block',
      moduleId: 'm1',
      unitId: 'u1',
      blockIdent: 'b1',
      title: 'Compound interest',
      deepLink: '/de/course/1/module/1/unit/1/block/b1',
    },
    material: {
      title: 'Reading',
      blockType: 'pdf',
      blockIdent: 'b1',
      availability: 'full-text',
      excerpt: longExcerpt(),
      excerptTruncated: false,
      revision: 'rev-1',
    },
    outline: [
      {
        ident: 'b1',
        title: 'Compound interest',
        blockType: 'pdf',
        availability: 'full-text',
        completion: 'confirmed_complete',
      },
    ],
    completion: {
      unitState: 'pending',
      completedBlocks: 1,
      totalBlocks: 3,
      observedAt: '2026-09-12T10:00:00Z',
    },
    ...overrides,
  }
}

async function signSnapshotEnvelope(payload: {
  chatbotId?: string
  klickerCourseId?: string
  snapshot?: unknown
  sub?: string
  expiresInSeconds?: number
  claims?: Record<string, unknown>
}) {
  const now = Math.floor(Date.now() / 1000)
  return signJWT(
    {
      scope: 'ELEARNING_SNAPSHOT',
      purpose: 'learning-context',
      aud: 'klicker-chat',
      chatbotId: payload.chatbotId ?? CHATBOT_ID,
      klickerCourseId: payload.klickerCourseId ?? COURSE_ID,
      snapshot: payload.snapshot ?? baseSnapshot(),
      sub: payload.sub ?? LEARNER_BINDING,
      iat: now,
      exp: now + (payload.expiresInSeconds ?? 300),
      ...payload.claims,
    },
    SECRET,
    { issuer: 'elearning' }
  )
}

function verifyWith(snapshot: unknown) {
  return async (opts?: {
    chatbotId?: string
    klickerCourseId?: string
    learnerBinding?: string | null
    token?: string
  }) => {
    const token = opts?.token ?? (await signSnapshotEnvelope({ snapshot }))
    return verifyAndNormalizeElearningChatContext(token, {
      chatbotId: opts?.chatbotId ?? CHATBOT_ID,
      klickerCourseId: opts?.klickerCourseId ?? COURSE_ID,
      learnerBinding:
        opts?.learnerBinding === null
          ? null
          : (opts?.learnerBinding ?? LEARNER_BINDING),
    })
  }
}

beforeEach(() => {
  vi.stubEnv('ELEARNING_CHAT_HANDOFF_SECRET', SECRET)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('verifyAndNormalizeElearningChatContext', () => {
  it('accepts a matching envelope and returns the verified snapshot', async () => {
    const result = await verifyWith(baseSnapshot())()
    expect(result).not.toBeNull()
    expect(result?.snapshot.snapshotId).toBe('snap-1')
    expect(result?.snapshot.material.availability).toBe('full-text')
    expect(result?.snapshot.completion?.unitState).toBe('pending')
  })

  it('rejects a snapshot bound to another chatbot', async () => {
    const result = await verifyWith(baseSnapshot())({
      chatbotId: 'other-chatbot',
    })
    expect(result).toBeNull()
  })

  it('rejects a snapshot bound to another Klicker course', async () => {
    const result = await verifyWith(baseSnapshot())({
      klickerCourseId: 'other-course',
    })
    expect(result).toBeNull()
  })

  it('rejects a foreign learner binding', async () => {
    const result = await verifyWith(baseSnapshot())({
      learnerBinding: 'someone-else',
    })
    expect(result).toBeNull()
  })

  it('rejects when the request identity has no learner binding', async () => {
    const result = await verifyWith(baseSnapshot())({ learnerBinding: null })
    expect(result).toBeNull()
  })

  it('rejects an expired envelope', async () => {
    const token = await signSnapshotEnvelope({
      snapshot: baseSnapshot(),
      expiresInSeconds: -10,
    })
    const result = await verifyAndNormalizeElearningChatContext(token, {
      chatbotId: CHATBOT_ID,
      klickerCourseId: COURSE_ID,
      learnerBinding: LEARNER_BINDING,
    })
    expect(result).toBeNull()
  })

  it.each([
    { aud: undefined },
    { aud: 'foreign-chat' },
    { purpose: undefined },
    { purpose: 'chat-handoff' },
    { exp: Math.floor(Date.now() / 1000) + 3600 },
  ])('rejects an envelope outside its token contract (%j)', async (claims) => {
    const token = await signSnapshotEnvelope({ claims })
    expect(await verifyWith(baseSnapshot())({ token })).toBeNull()
  })

  it('requires the chat audience for login grants', async () => {
    const token = await signJWT(
      {
        sub: 'synthetic-learner',
        scope: 'ELEARNING_CHAT',
        purpose: 'chat-handoff',
        chatbotId: CHATBOT_ID,
        klickerCourseId: COURSE_ID,
        elearningCourseId: '42',
      },
      SECRET,
      { issuer: 'elearning', expiresIn: '2m' }
    )
    await expect(verifyElearningChatGrant(token, SECRET)).rejects.toThrow()
  })

  it('rejects a tampered envelope', async () => {
    const token = await signSnapshotEnvelope({ snapshot: baseSnapshot() })
    const tampered =
      token.slice(0, token.length - 4) +
      (token.endsWith('aaaa') ? 'bbbb' : 'aaaa')
    const result = await verifyAndNormalizeElearningChatContext(tampered, {
      chatbotId: CHATBOT_ID,
      klickerCourseId: COURSE_ID,
      learnerBinding: LEARNER_BINDING,
    })
    expect(result).toBeNull()
  })

  it('rejects snapshots with unknown fields', async () => {
    const result = await verifyWith(baseSnapshot({ injectedField: 'x' }))()
    expect(result).toBeNull()
  })

  it('rejects non host-relative deep links', async () => {
    const snapshot = baseSnapshot()
    const location = {
      ...(snapshot.location as Record<string, unknown>),
      deepLink: 'https://evil.example/x',
    }
    const result = await verifyWith({
      ...(snapshot as Record<string, unknown>),
      location,
    })()
    expect(result).toBeNull()
  })

  it('rejects an excerpt beyond the maximum length', async () => {
    const result = await verifyWith(
      baseSnapshot({
        material: {
          title: 'Reading',
          blockType: 'pdf',
          blockIdent: 'b1',
          availability: 'full-text',
          excerpt: 'x'.repeat(ELEARNING_SNAPSHOT_EXCERPT_MAX_LENGTH + 1),
          excerptTruncated: true,
          revision: 'rev-1',
        },
      })
    )()
    expect(result).toBeNull()
  })

  it('rejects an outline beyond the item cap', async () => {
    const result = await verifyWith(
      baseSnapshot({
        outline: Array.from(
          { length: ELEARNING_SNAPSHOT_OUTLINE_MAX_ITEMS + 1 },
          () => ({
            ident: 'b1',
            title: 'Compound interest',
            blockType: 'pdf',
            availability: 'full-text',
            completion: 'confirmed_complete',
          })
        ),
      })
    )()
    expect(result).toBeNull()
  })
})

describe('normalizePersistedLearningContext', () => {
  it('round-trips a valid persisted context', () => {
    const snapshot = baseSnapshot()
    expect(normalizePersistedLearningContext(snapshot)).toEqual(snapshot)
  })

  it('normalizes legacy and foreign shapes to null', () => {
    expect(normalizePersistedLearningContext(null)).toBeNull()
    expect(normalizePersistedLearningContext(undefined)).toBeNull()
    expect(normalizePersistedLearningContext('context')).toBeNull()
    expect(normalizePersistedLearningContext({})).toBeNull()
    expect(normalizePersistedLearningContext([baseSnapshot()])).toBeNull()
    expect(
      normalizePersistedLearningContext({ snapshotId: 'only-id' })
    ).toBeNull()
  })
})

describe('page evidence', () => {
  it('treats any supplied page text as usable evidence', () => {
    const shortPage = baseSnapshot({
      material: { availability: 'full-text', excerpt: 'Zinseszins.' },
    })
    expect(hasElearningPageEvidence(shortPage as never)).toBe(true)
  })

  it('treats metadata-only material as having no page text', () => {
    const snapshot = baseSnapshot({
      material: {
        title: 'Animation',
        blockType: 'animation',
        availability: 'metadata',
      },
    })
    expect(hasElearningPageEvidence(snapshot as never)).toBe(false)
  })

  it('treats a blank excerpt and a missing snapshot as no evidence', () => {
    const blank = baseSnapshot({
      material: { availability: 'full-text', excerpt: '   ' },
    })
    expect(hasElearningPageEvidence(blank as never)).toBe(false)
    expect(hasElearningPageEvidence(null)).toBe(false)
  })
})

describe('formatElearningGroundingPolicy', () => {
  it('embeds the snapshot as intact JSON data', () => {
    const prompt = formatElearningGroundingPolicy(baseSnapshot() as never)
    const fence = prompt.split('```json')[1]
    expect(fence).toBeDefined()
    const parsed = JSON.parse(fence.split('```')[0])
    expect(parsed.location.blockIdent).toBe('b1')
    expect(parsed.material.availability).toBe('full-text')
    expect(parsed.completion.totalBlocks).toBe(3)
  })

  it('keeps completion only when present', () => {
    const withCompletion = baseSnapshot() as never
    const withoutCompletion = baseSnapshot({
      completion: undefined,
      outline: undefined,
    }) as never
    expect(
      formatElearningGroundingPolicy(withCompletion).includes('"completion": {')
    ).toBe(true)
    expect(
      formatElearningGroundingPolicy(withoutCompletion).includes(
        '"completion": {'
      )
    ).toBe(false)
  })

  it('reports the limitation when no usable page text was supplied', () => {
    const withText = baseSnapshot() as never
    const metadataOnly = baseSnapshot({
      material: {
        title: 'Animation',
        blockType: 'animation',
        availability: 'metadata',
      },
    }) as never
    const withTextPolicy = formatElearningGroundingPolicy(withText)
    const metadataPolicy = formatElearningGroundingPolicy(metadataOnly)
    expect(metadataPolicy).toContain('No usable page text')
    expect(withTextPolicy).not.toContain('No usable page text')
    expect(metadataPolicy).toContain('"availability": "metadata"')
  })

  it('emits the materials-only policy even without a snapshot', () => {
    const prompt = formatElearningGroundingPolicy(null)
    expect(prompt).toContain('eLearning evidence policy')
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).not.toContain('```json')
  })

  it('does not gate short page text behind a length threshold', () => {
    const shortPage = baseSnapshot({
      material: { availability: 'full-text', excerpt: 'Zinseszins.' },
    }) as never
    expect(formatElearningGroundingPolicy(shortPage)).not.toContain(
      'No usable page text'
    )
  })
})

describe('eLearning thread origin', () => {
  it('tags the origin from the handoff binding or a verified context', () => {
    expect(resolveElearningThreadOrigin({ learnerBinding: 'binding' })).toBe(
      'elearning'
    )
    expect(resolveElearningThreadOrigin({ hasVerifiedContext: true })).toBe(
      'elearning'
    )
    expect(resolveElearningThreadOrigin({})).toBeUndefined()
  })

  it('keeps a handoff session on the policy without a thread tag', () => {
    expect(isElearningOriginThread({ learnerBinding: 'binding' })).toBe(true)
    expect(isElearningOriginThread({ threadOrigin: 'elearning' })).toBe(true)
    expect(isElearningOriginThread({ threadOrigin: null })).toBe(false)
    expect(isElearningOriginThread({})).toBe(false)
  })
})
