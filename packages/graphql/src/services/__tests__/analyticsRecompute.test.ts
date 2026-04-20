import type { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock child_process.spawn so no Python runtime is required. The mock is
// module-scoped state the tests mutate before calling the handler; this is
// simpler than a per-test vi.mock factory and keeps the assertions readable.
const spawnMock = vi.hoisted(() => vi.fn())
vi.mock('child_process', () => ({ spawn: spawnMock }))

import { handleRunAnalyticsScript } from '../analyticsRecompute.js'

type FakeChild = EventEmitter & {
  stdout: PassThrough
  stderr: PassThrough
  kill: (signal?: string) => void
}

function fakeSpawnResult(exitCode: number): FakeChild {
  const child = new PassThrough() as unknown as FakeChild
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = () => {}
  // Fire close asynchronously so the handler has time to attach listeners.
  queueMicrotask(() => {
    child.emit('close', exitCode)
  })
  return child
}

function fakeCtx() {
  const logs = { info: [] as string[], error: [] as string[] }
  return {
    logger: {
      info: (msg: string) => {
        logs.info.push(msg)
      },
      error: (msg: string) => {
        logs.error.push(msg)
      },
    },
    logs,
  } as any
}

describe('handleRunAnalyticsScript', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    spawnMock.mockReset()
    process.env = { ...ORIGINAL_ENV, ANALYTICS_CWD: '/tmp/analytics-fake' }
    delete process.env.ANALYTICS_ALLOW_FULL
  })

  afterEach(() => {
    process.env = ORIGINAL_ENV
  })

  it('resolves on subprocess exit code 0', async () => {
    spawnMock.mockImplementation(() => fakeSpawnResult(0))
    const ctx = fakeCtx()
    await expect(
      handleRunAnalyticsScript(
        { scriptModule: 'src.scripts.13_platform_semester_analytics' },
        {} as any,
        ctx
      )
    ).resolves.toBeUndefined()
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('throws on non-zero subprocess exit', async () => {
    spawnMock.mockImplementation(() => fakeSpawnResult(1))
    const ctx = fakeCtx()
    await expect(
      handleRunAnalyticsScript(
        { scriptModule: 'src.scripts.13_platform_semester_analytics' },
        {} as any,
        ctx
      )
    ).rejects.toThrow(/exited with code 1/)
    // Failure should have been logged through executionCtx.logger.error
    expect(ctx.logs.error.some((m: string) => m.includes('FAILED'))).toBe(true)
  })

  it('rejects mode=full without ANALYTICS_ALLOW_FULL', async () => {
    spawnMock.mockImplementation(() => fakeSpawnResult(0))
    const ctx = fakeCtx()
    await expect(
      handleRunAnalyticsScript(
        {
          scriptModule: 'src.scripts.13_platform_semester_analytics',
          mode: 'full',
        },
        {} as any,
        ctx
      )
    ).rejects.toThrow(/ANALYTICS_ALLOW_FULL/)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('accepts mode=full with ANALYTICS_ALLOW_FULL=1', async () => {
    process.env.ANALYTICS_ALLOW_FULL = '1'
    spawnMock.mockImplementation(() => fakeSpawnResult(0))
    const ctx = fakeCtx()
    await expect(
      handleRunAnalyticsScript(
        {
          scriptModule: 'src.scripts.13_platform_semester_analytics',
          mode: 'full',
        },
        {} as any,
        ctx
      )
    ).resolves.toBeUndefined()
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })

  it('throws when ANALYTICS_CWD is unset', async () => {
    delete process.env.ANALYTICS_CWD
    const ctx = fakeCtx()
    await expect(
      handleRunAnalyticsScript(
        { scriptModule: 'src.scripts.13_platform_semester_analytics' },
        {} as any,
        ctx
      )
    ).rejects.toThrow(/ANALYTICS_CWD/)
    expect(spawnMock).not.toHaveBeenCalled()
  })

  it('throws on mode=finalize without a courseId', async () => {
    spawnMock.mockImplementation(() => fakeSpawnResult(0))
    const ctx = fakeCtx()
    await expect(
      handleRunAnalyticsScript(
        {
          scriptModule: 'src.scripts.13_platform_semester_analytics',
          mode: 'finalize',
        },
        {} as any,
        ctx
      )
    ).rejects.toThrow(/finalize/)
    expect(spawnMock).not.toHaveBeenCalled()
  })
})
