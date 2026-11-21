import { describe, expect, it } from 'vitest'
import {
  signResponseExampleBaselineJob,
  verifyResponseExampleBaselineJob,
} from '../src/auth.js'
import { computeResponseExampleBaselineConfigurationDigest } from '../src/responseExampleRuntime.js'

const scope = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  chatbotId: '22222222-2222-4222-8222-222222222222',
  runId: '33333333-3333-4333-8333-333333333333',
  caseId: '44444444-4444-4444-8444-444444444444',
}
const secret = 'example-local-job-key-never-used-outside-this-test'
const now = new Date('2026-10-28T10:00:00Z')
describe('baseline worker scope', () => {
  it('binds every identity and expires without exposing example content', async () => {
    const token = await signResponseExampleBaselineJob(scope, secret, now)
    await expect(
      verifyResponseExampleBaselineJob(token, scope, secret, now)
    ).resolves.toBeUndefined()
    for (const key of Object.keys(scope))
      await expect(
        verifyResponseExampleBaselineJob(
          token,
          { ...scope, [key]: '55555555-5555-4555-8555-555555555555' },
          secret,
          now
        )
      ).rejects.toThrow()
    await expect(
      verifyResponseExampleBaselineJob(
        token,
        scope,
        secret,
        new Date(now.getTime() + 91_000)
      )
    ).rejects.toThrow()
    await expect(
      verifyResponseExampleBaselineJob(`${token}tamper`, scope, secret, now)
    ).rejects.toThrow()
    await expect(
      signResponseExampleBaselineJob(scope, undefined, now)
    ).rejects.toThrow()
  })
  it('captures effective configuration without row bookkeeping or object-order drift', () => {
    const config = {
      systemPrompts: { tutor: { prompt: 'synthetic' } },
      course: { displayName: 'synthetic course' },
      mcpConfigurations: [{ id: 'synthetic', parameters: { b: 2, a: 1 } }],
    }
    expect(computeResponseExampleBaselineConfigurationDigest(config)).toBe(
      computeResponseExampleBaselineConfigurationDigest({
        ...config,
        updatedAt: new Date(),
        mcpConfigurations: [{ parameters: { a: 1, b: 2 }, id: 'synthetic' }],
      })
    )
    expect(computeResponseExampleBaselineConfigurationDigest(config)).not.toBe(
      computeResponseExampleBaselineConfigurationDigest({
        ...config,
        knowledgeGraphRetrievalEnabled: true,
      })
    )
  })
})
