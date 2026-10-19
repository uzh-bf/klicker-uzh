import { describe, expect, test } from 'vitest'
import {
  detectBrowserEngine,
  isCodeExecutionSupported,
} from '@/src/lib/code-runner/engine'
import {
  hostResult,
  MAX_RUNNER_MESSAGE_CHARS,
  parseRunnerMessage,
  RUNNER_OUTPUT_CAP,
} from '@/src/lib/code-runner/protocol'

const expected = { generation: 3, attemptId: 'attempt-3' }
const result = {
  type: 'result',
  attemptId: 'attempt-3',
  generation: 3,
  status: 'ok',
  stdout: 'hello\n',
  stderr: '',
  truncated: false,
  error: null,
}

describe('code runner bridge protocol', () => {
  test('accepts a result only for the current generation and attempt', () => {
    expect(parseRunnerMessage(result, expected)).toMatchObject({
      event: { kind: 'result', status: 'ok', stdout: 'hello\n' },
    })
    expect(
      parseRunnerMessage({ ...result, attemptId: 'attempt-2' }, expected)
    ).toEqual({ rejected: 'stale-attempt' })
    expect(parseRunnerMessage({ ...result, generation: 2 }, expected)).toEqual({
      rejected: 'stale-attempt',
    })
    expect(
      parseRunnerMessage(result, { generation: 3, attemptId: null })
    ).toEqual({ rejected: 'stale-attempt' })
  })

  test('rejects oversized, malformed and unknown messages', () => {
    expect(
      parseRunnerMessage(
        { ...result, stdout: 'x'.repeat(MAX_RUNNER_MESSAGE_CHARS) },
        expected
      )
    ).toEqual({ rejected: 'oversize' })
    expect(parseRunnerMessage('result', expected)).toEqual({
      rejected: 'bad-shape',
    })
    expect(parseRunnerMessage({ type: 'eval' }, expected)).toEqual({
      rejected: 'bad-shape',
    })
    const cyclic: Record<string, unknown> = { type: 'result' }
    cyclic.self = cyclic
    expect(parseRunnerMessage(cyclic, expected)).toEqual({
      rejected: 'unserializable',
    })
  })

  test('bounds output and maps unexpected statuses to unknown', () => {
    const parsed = parseRunnerMessage(
      {
        ...result,
        status: 'server-verified',
        stdout: 'y'.repeat(RUNNER_OUTPUT_CAP + 10),
      },
      expected
    )

    expect(parsed).toMatchObject({
      event: { kind: 'result', status: 'unknown', truncated: true },
    })
    if ('event' in parsed && parsed.event.kind === 'result') {
      expect(parsed.event.stdout).toHaveLength(RUNNER_OUTPUT_CAP)
    }
  })

  test('assigns browser-reported provenance on the host', () => {
    expect(hostResult('attempt-3', 'timeout').provenance).toBe(
      'browser-reported'
    )
  })
})

describe('code runner engine support', () => {
  test.each([
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
      'chromium',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      'webkit',
    ],
    [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/146.0 Mobile/15E148 Safari/605.1.15',
      'webkit',
    ],
    [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0',
      'gecko',
    ],
    ['curl/8.0', 'unknown'],
  ])('classifies %s', (userAgent, engine) => {
    expect(detectBrowserEngine(userAgent)).toBe(engine)
  })

  test('supports only the qualified engines', () => {
    expect(isCodeExecutionSupported('chromium')).toBe(true)
    expect(isCodeExecutionSupported('webkit')).toBe(true)
    expect(isCodeExecutionSupported('gecko')).toBe(false)
    expect(isCodeExecutionSupported('unknown')).toBe(false)
  })
})
