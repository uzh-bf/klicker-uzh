import { generateText, isStepCount, type ModelMessage, tool } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { describe, expect, test } from 'vitest'
import { z } from 'zod'
import { withModelCitationIndices } from '../src/lib/server/citationInstructions'
import { mapAssistantStepContent } from '../src/lib/server/persistedAssistantContent'
import { normalizeSourcesFromParts } from '../src/lib/sources/normalizeSources'

const group = (reference: string, chunks = 1) => ({
  reference,
  title: 'Material',
  citation_index: 99,
  chunks: Array.from({ length: chunks }, (_, i) => ({
    content: `Passage ${i}`,
    page_number: i + 1,
  })),
})
const payload = (...sources: unknown[]) => ({ mode: 'documents', sources })
const call = (id: string, toolName = 'KB_doc_query') => ({
  type: 'tool-call',
  toolCallId: id,
  toolName,
  input: {},
})
const result = (id: string, output: unknown) => ({
  type: 'tool-result',
  toolCallId: id,
  toolName: 'KB_doc_query',
  output,
})
const message = (id: string, value = '{}'): ModelMessage => ({
  role: 'tool',
  content: [
    {
      type: 'tool-result',
      toolCallId: id,
      toolName: 'KB_doc_query',
      output: { type: 'text', value },
    },
  ],
})
function projectedPayload(messages: ModelMessage[], index = 0) {
  const message = messages[index]
  if (message?.role !== 'tool') throw new Error('Expected tool message')
  const part = message.content[0]
  if (part?.type !== 'tool-result' || part.output.type !== 'text') {
    throw new Error('Expected projected text output')
  }
  return JSON.parse(part.output.value)
}

describe('model-only citation indices', () => {
  test('retains supplementary text and multimodal blocks without accumulating projections', () => {
    const raw = payload(group('urn:a'))
    const image = {
      type: 'image-data' as const,
      data: 'AA==',
      mediaType: 'image/png',
    }
    const messages: ModelMessage[] = [
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'a',
            toolName: 'KB_doc_query',
            output: {
              type: 'content',
              value: [
                {
                  type: 'text',
                  text: JSON.stringify(payload(group('urn:wrong'))),
                },
                { type: 'text', text: 'Supplementary diagnostic' },
                image,
              ],
            },
          },
        ],
      },
    ]
    const steps = [{ content: [call('a'), result('a', raw)] }]
    const projected = withModelCitationIndices(messages, steps)
    expect(withModelCitationIndices(projected, steps)).toEqual(projected)
    expect(JSON.stringify(projected)).not.toContain('urn:wrong')
    expect(projected).toMatchObject([
      {
        content: [
          {
            output: {
              value: [
                { type: 'text' },
                { type: 'text', text: 'Supplementary diagnostic' },
                image,
              ],
            },
          },
        ],
      },
    ])
  })
  test('SDK continuation receives projected IDs while step results retain original payloads', async () => {
    const raw = payload(group('urn:source:a', 20))
    const usage = {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    }
    const model = new MockLanguageModelV4({
      doGenerate: [
        {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'a',
              toolName: 'KB_doc_query',
              input: '{}',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage,
          warnings: [],
        },
        {
          content: [{ type: 'text', text: 'Supported [1]' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage,
          warnings: [],
        },
      ],
    })
    const response = await generateText({
      model,
      prompt: 'Synthetic request',
      tools: {
        KB_doc_query: tool({
          inputSchema: z.object({}),
          execute: async () => raw,
        }),
      },
      stopWhen: isStepCount(2),
      prepareStep: ({ initialMessages, responseMessages, steps }) => ({
        messages: [
          ...initialMessages,
          ...withModelCitationIndices(responseMessages, steps),
        ],
      }),
    })
    expect(model.doGenerateCalls).toHaveLength(2)
    const toolMessage = model.doGenerateCalls[1]?.prompt.find(
      (message) => message.role === 'tool'
    )
    expect(toolMessage?.role).toBe('tool')
    if (toolMessage?.role !== 'tool') throw new Error('Missing tool request')
    const part = toolMessage.content[0]
    expect(part?.type).toBe('tool-result')
    if (part?.type !== 'tool-result' || part.output.type !== 'text')
      throw new Error('Missing text projection')
    expect(JSON.parse(part.output.value).sources[0].citation_index).toBe(1)
    expect(response.steps[0]?.toolResults[0]?.output).toEqual(raw)
  })
  test('one group with 20 passages has one UI-matching index without changing raw data', () => {
    const source = group('urn:source:a', 20)
    const raw = payload(source)
    const steps = [{ content: [call('a'), result('a', raw)] }]
    const messages = [message('a')]
    const before = structuredClone({ steps, messages })
    const projected = withModelCitationIndices(messages, steps)
    const canonical = normalizeSourcesFromParts(mapAssistantStepContent(steps))
    expect(projectedPayload(projected).sources).toEqual([
      { ...source, citation_index: canonical[0]?.index },
    ])
    expect(canonical).toHaveLength(1)
    expect({ steps, messages }).toEqual(before)
    expect(withModelCitationIndices(projected, steps)).toEqual(projected)
  })

  test('uses call order despite reversed completion and reuses indices across searches', () => {
    const a = group('urn:a'),
      b = group('urn:b'),
      c = group('urn:c')
    const steps = [
      {
        content: [
          call('first'),
          call('second'),
          result('second', payload(b, c)),
          result('first', payload(a, b)),
        ],
      },
    ]
    const projected = withModelCitationIndices(
      [message('second'), message('first')],
      steps
    )
    expect(
      projectedPayload(projected).sources.map(
        (s: { citation_index: number | null }) => s.citation_index
      )
    ).toEqual([2, 3])
    expect(
      projectedPayload(projected, 1).sources.map(
        (s: { citation_index: number | null }) => s.citation_index
      )
    ).toEqual([1, 2])
    const reset = withModelCitationIndices(
      [message('second')],
      [{ content: [call('second'), result('second', payload(b, c))] }]
    )
    expect(
      projectedPayload(reset).sources.map(
        (s: { citation_index: number | null }) => s.citation_index
      )
    ).toEqual([1, 2])
  })

  test('caps new identities but still maps admitted repeats after overflow and skips invalid entries', () => {
    const sources = Array.from({ length: 13 }, (_, i) => group(`urn:${i}`))
    const steps = [
      { content: [call('a'), result('a', payload(...sources))] },
      {
        content: [
          call('b'),
          result('b', payload(null, {}, sources[0], sources[12])),
        ],
      },
    ]
    const projected = withModelCitationIndices(
      [message('a'), message('b')],
      steps
    )
    expect(
      projectedPayload(projected).sources.map(
        (s: { citation_index: number | null }) => s.citation_index
      )
    ).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, null])
    expect(projectedPayload(projected, 1).sources).toEqual([
      null,
      { citation_index: null },
      { ...sources[0], citation_index: 1 },
      { ...sources[12], citation_index: null },
    ])
  })

  test('prefers canonical FastMCP structured data over conflicting text', () => {
    const raw = {
      content: [
        { type: 'text', text: JSON.stringify(payload(group('urn:wrong'))) },
      ],
      structuredContent: {
        result: JSON.stringify(payload(group('urn:correct'))),
      },
    }
    const projected = withModelCitationIndices(
      [message('a', raw.content[0]!.text)],
      [{ content: [call('a'), result('a', raw)] }]
    )
    expect(projectedPayload(projected).sources[0]).toMatchObject({
      reference: 'urn:correct',
      citation_index: 1,
    })
  })

  test.each([
    undefined,
    'invalid json',
    { error: 'failed' },
    { isError: true, content: [] },
  ])('does not annotate a failed or malformed result', (raw) => {
    const messages = [message('a')]
    expect(
      withModelCitationIndices(messages, [
        { content: [call('a'), result('a', raw)] },
      ])
    ).toEqual(messages)
  })

  test('does not change unrelated tool messages', () => {
    const messages = [message('a')]
    const steps = [
      { content: [call('a', 'weather'), result('a', payload(group('urn:a')))] },
    ]
    expect(withModelCitationIndices(messages, steps)).toEqual(messages)
  })
})
