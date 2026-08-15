import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'

import {
  COURSE_WORKFLOW_NAME,
  PLATFORM_WORKFLOW_NAME,
  canonicalContract,
  canonicalContractDigest,
  courseInputWithWindowFixture,
  courseInputWithoutWindowFixture,
  courseWorkflowInputSchema,
  courseWorkflowSuccessSchema,
  createAnalyticsEngineStubs,
  platformInputFixture,
  runBlackBoxConformance,
} from '../src/index.js'

describe('@klicker-uzh/analytics-engine-contract', () => {
  it.each([
    [
      'wrong contract version',
      { ...courseInputWithWindowFixture, contractVersion: 'v2' },
    ],
    ['unknown field', { ...courseInputWithWindowFixture, unexpected: true }],
    [
      'invalid run UUID',
      { ...courseInputWithWindowFixture, runId: 'not-a-uuid' },
    ],
    [
      'invalid calendar date',
      { ...courseInputWithWindowFixture, windowSince: '2026-02-29' },
    ],
    ['invalid mode', { ...courseInputWithWindowFixture, mode: 'replay' }],
  ])('rejects course input with %s', async (_description, input) => {
    const stubs = createAnalyticsEngineStubs(async () => {
      throw new Error('The invoker must not run for invalid input')
    })

    await expect(
      stubs.course(input as typeof courseInputWithWindowFixture)
    ).rejects.toThrow(ZodError)
  })

  it('rejects explicitly undefined optional windows', () => {
    expect(() =>
      courseWorkflowInputSchema.parse({
        ...courseInputWithoutWindowFixture,
        windowSince: undefined,
      })
    ).toThrow(ZodError)
    expect(() =>
      courseWorkflowSuccessSchema.parse({
        ...courseInputWithoutWindowFixture,
        windowSince: undefined,
        completedAt: '2026-08-15T12:00:00Z',
      })
    ).toThrow(ZodError)
  })

  it.each([
    ['timezone-naive datetime', '2026-08-15T12:00:00'],
    ['missing seconds', '2026-08-15T12:00Z'],
    ['invalid calendar date', '2026-02-29T12:00:00Z'],
    ['invalid offset', '2026-08-15T12:00:00+24:00'],
  ])('rejects success output with %s', (_description, completedAt) => {
    expect(() =>
      courseWorkflowSuccessSchema.parse({
        ...courseInputWithWindowFixture,
        completedAt,
      })
    ).toThrow(ZodError)
  })

  it('dispatches exact workflow names and validates successful outputs', async () => {
    const calls: Array<[string, unknown]> = []
    const stubs = createAnalyticsEngineStubs(async (workflowName, input) => {
      calls.push([workflowName, input])
      return {
        ...(input as Record<string, unknown>),
        completedAt: '2026-08-15T12:00:00+02:00',
      }
    })

    await stubs.course(courseInputWithWindowFixture)
    await stubs.platform(platformInputFixture)

    expect(calls).toEqual([
      [COURSE_WORKFLOW_NAME, courseInputWithWindowFixture],
      [PLATFORM_WORKFLOW_NAME, platformInputFixture],
    ])
  })

  it('rejects malformed output and a mismatched identity echo', async () => {
    const malformedStub = createAnalyticsEngineStubs(async () => ({
      contractVersion: 'v1',
      runId: courseInputWithWindowFixture.runId,
      courseId: courseInputWithWindowFixture.courseId,
      mode: courseInputWithWindowFixture.mode,
      windowSince: courseInputWithWindowFixture.windowSince,
      completedAt: '2026-08-15T12:00:00',
    }))
    await expect(
      malformedStub.course(courseInputWithWindowFixture)
    ).rejects.toBeInstanceOf(ZodError)

    const mismatchedStub = createAnalyticsEngineStubs(async () => ({
      ...courseInputWithWindowFixture,
      runId: courseInputWithoutWindowFixture.runId,
      completedAt: '2026-08-15T12:00:00Z',
    }))
    await expect(
      mismatchedStub.course(courseInputWithWindowFixture)
    ).rejects.toThrow('changed runId')
  })

  it.each([
    ['failure', new Error('synthetic failure')],
    ['cancellation', new Error('synthetic cancellation')],
  ])('preserves callback %s rejection', async (_scenario, rejection) => {
    const stubs = createAnalyticsEngineStubs(async () => {
      throw rejection
    })

    await expect(stubs.course(courseInputWithWindowFixture)).rejects.toBe(
      rejection
    )
  })

  it('runs black-box success, invalid-input, failure, and cancelled scenarios', async () => {
    const callbackCalls: Array<{
      workflowName: string
      input: unknown
      scenario: string
    }> = []
    const failure = new Error('synthetic workflow failure')
    const cancellation = new Error('synthetic workflow cancellation')

    await runBlackBoxConformance(async (scenario, workflowName, input) => {
      callbackCalls.push({ workflowName, input, scenario })

      if (scenario === 'invalid-input') {
        courseWorkflowInputSchema.parse(input)
        throw new Error('Invalid input unexpectedly passed validation')
      }
      if (scenario === 'failure') throw failure
      if (scenario === 'cancelled') throw cancellation

      return {
        ...(input as Record<string, unknown>),
        completedAt: '2026-08-15T12:00:00Z',
      }
    })

    expect(
      callbackCalls.map(({ workflowName, scenario }) => [
        workflowName,
        scenario,
      ])
    ).toEqual([
      [COURSE_WORKFLOW_NAME, 'success'],
      [COURSE_WORKFLOW_NAME, 'success'],
      [PLATFORM_WORKFLOW_NAME, 'success'],
      [COURSE_WORKFLOW_NAME, 'invalid-input'],
      [COURSE_WORKFLOW_NAME, 'failure'],
      [PLATFORM_WORKFLOW_NAME, 'cancelled'],
    ])
    expect(callbackCalls[0]?.input).not.toHaveProperty('scenario')
  })

  it('pins a reproducible SHA-256 digest for the readonly contract tree', () => {
    const digest = createHash('sha256')
      .update(JSON.stringify(canonicalContract))
      .digest('hex')

    expect(digest).toBe(canonicalContractDigest)
    expect(canonicalContractDigest).toBe(
      'b9a3f0e14c766c234aead4165e5250f75bf13d02f84f905baedbf6fb4c0d733c'
    )
  })
})
