import { describe, expect, it, vi } from 'vitest'
import {
  parseFinanceWikiAttachmentCliArgs,
  runFinanceWikiAttachmentCli,
} from './financewiki-attachment-run.js'

const acquireLock = vi.hoisted(() => vi.fn())
vi.mock('./doc-query-cohort-activation-run.js', () => ({
  acquireCohortActivationSessionLock: acquireLock,
}))

describe('FinanceWiki attachment CLI', () => {
  const paths = ['--manifest', 'manifest.json', '--receipt', 'receipt.json']

  it('keeps plan as the default and accepts an explicit first action', () => {
    expect(parseFinanceWikiAttachmentCliArgs(paths).action).toBe('plan')
    expect(parseFinanceWikiAttachmentCliArgs(['plan', ...paths]).action).toBe(
      'plan'
    )
    expect(parseFinanceWikiAttachmentCliArgs(['apply', ...paths]).action).toBe(
      'apply'
    )
  })

  it.each([
    ['plan', 'plan', ...paths],
    ['apply', 'plan', ...paths],
    ['plan', 'apply', ...paths],
    [...paths, 'plan'],
  ])('rejects repeated or misplaced actions: %j', (...args) => {
    expect(() => parseFinanceWikiAttachmentCliArgs(args)).toThrowError(
      expect.objectContaining({ code: 'INVALID_ARGUMENTS' })
    )
  })

  it.each([
    ['SESSION_LOCKED', 'SESSION_LOCKED'],
    ['synthetic internal failure', 'OPERATION_FAILED'],
  ])('classifies lock acquisition failure %s as %s', async (message, code) => {
    acquireLock.mockRejectedValueOnce(new Error(message))
    const output: string[] = []
    const exitCode = await runFinanceWikiAttachmentCli(
      ['readback', '--receipt', 'receipt.json'],
      { write: (line) => output.push(line) }
    )
    expect(exitCode).toBe(1)
    expect(output).toHaveLength(1)
    expect(JSON.parse(output[0]!).error.code).toBe(code)
  })
})
