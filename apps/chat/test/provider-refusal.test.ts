import type { TextStreamPart, ToolSet } from 'ai'
import { describe, expect, test, vi } from 'vitest'

import { providerRefusalTransform } from '../src/lib/server/providerRefusal'

type Part = TextStreamPart<ToolSet>

const DEFLECTION = 'Stay with the activity.'

function step(
  texts: string[],
  usage: { inputTokens?: number; outputTokens?: number }
): Part[] {
  return [
    { type: 'start-step' },
    { type: 'text-start', id: 't1' },
    ...texts.map((text) => ({ type: 'text-delta', id: 't1', text })),
    { type: 'text-end', id: 't1' },
    { type: 'finish-step', finishReason: 'stop', usage },
  ] as Part[]
}

async function run(parts: Part[], onSubstitute?: () => void) {
  const transform = providerRefusalTransform<ToolSet>(
    DEFLECTION,
    onSubstitute
  )({ tools: {}, stopStream: () => {} })
  const output: Part[] = []
  const reader = new ReadableStream<Part>({
    start(controller) {
      for (const part of parts) controller.enqueue(part)
      controller.close()
    },
  })
    .pipeThrough(transform)
    .getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return output
    output.push(value)
  }
}

const text = (parts: Part[]) =>
  parts.flatMap((p) => (p.type === 'text-delta' ? [p.text] : [])).join('')

describe('providerRefusalTransform', () => {
  test('replaces the text of an unbilled provider reply', async () => {
    const onSubstitute = vi.fn()
    const output = await run(
      step(['Generic ', 'refusal.'], { inputTokens: 0, outputTokens: 0 }),
      onSubstitute
    )

    expect(text(output)).toBe(DEFLECTION)
    expect(output.map((p) => p.type)).toEqual([
      'start-step',
      'text-start',
      'text-delta',
      'text-end',
      'finish-step',
    ])
    expect(onSubstitute).toHaveBeenCalledOnce()
  })

  test('keeps a short answer the model was billed for', async () => {
    const onSubstitute = vi.fn()
    const parts = step(['Short ', 'answer.'], {
      inputTokens: 4000,
      outputTokens: 3,
    })

    expect(await run(parts, onSubstitute)).toEqual(parts)
    expect(onSubstitute).not.toHaveBeenCalled()
  })

  test('releases a long answer before the step finishes', async () => {
    const parts = step(['x'.repeat(150), 'y'.repeat(150), 'z'], {
      inputTokens: 0,
      outputTokens: 0,
    })

    // Once the held text proves a genuine answer, the step is no longer
    // inspected, even if the provider later reports no usage.
    expect(text(await run(parts))).toBe(text(parts))
  })
})
