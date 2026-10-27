import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, isStepCount, type ModelMessage, tool } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { withModelCitationIndices } from '../src/lib/server/citationInstructions'
import { readCourseImage } from '../src/lib/server/courseImageStore'
import { withCourseImageTool } from '../src/lib/server/courseImageTools'
import {
  courseImageVisionEnabled,
  createCourseImageVision,
} from '../src/lib/server/courseImageVision'
import { mapAssistantStepContent } from '../src/lib/server/persistedAssistantContent'
import { courseImageCandidates } from '../src/lib/sources/courseImages'

const root = path.resolve('scripts/fixtures/course-images')
const fixture = JSON.parse(
  await readFile(path.join(root, 'query-result.json'), 'utf8')
)
const image = courseImageCandidates(fixture)[0]!
const original = await readCourseImage(image, root)
const messages: ModelMessage[] = [
  { role: 'user', content: 'Explain this process.' },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolName: 'KB_doc_query',
        toolCallId: 'search',
        input: { query: 'process' },
      },
    ],
  },
  {
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolName: 'KB_doc_query',
        toolCallId: 'search',
        output: { type: 'json', value: fixture },
      },
    ],
  },
]
function previewContent(messages: ModelMessage[]) {
  const last = messages.at(-1)
  if (last?.role !== 'tool') throw new Error('No retrieval result')
  const part = last.content[0]
  if (part?.type !== 'tool-result' || part.output.type !== 'content')
    throw new Error('No multimodal retrieval result')
  return part.output.value
}
function steps(output: unknown = fixture, toolName = 'KB_doc_query') {
  return [
    {
      content: [
        {
          type: 'tool-call',
          toolCallId: 'search',
          toolName,
          input: { query: 'process' },
        },
        { type: 'tool-result', toolCallId: 'search', toolName, output },
      ],
    },
  ]
}
function withAssets(ids: string[]) {
  const result = structuredClone(fixture)
  const envelope = result.sources[0].chunks[0].visual_assets
  envelope.assets = ids.map((id) => ({
    ...envelope.assets[0],
    asset_id: id.repeat(64),
  }))
  return result
}
afterEach(() => vi.unstubAllEnvs())

describe('request-local course figure vision', () => {
  it('does not replace a text-only question with a new user request', async () => {
    const question = 'Explain these stages in one sentence, text only.'
    const input: ModelMessage[] = [
      { role: 'user', content: question },
      ...messages.slice(1),
    ]
    const { prepareMessages: prepare } = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: (value) => readCourseImage(value, root),
    })
    const prepared = await prepare(input, steps())
    expect(prepared.previewCount).toBe(1)
    expect(prepared.messages.filter((part) => part.role === 'user')).toEqual([
      { role: 'user', content: question },
    ])
    expect(prepared.messages.map((part) => part.role)).toEqual(
      input.map((part) => part.role)
    )
    expect(
      previewContent(prepared.messages).some((part) => part.type === 'file')
    ).toBe(true)
  })
  it('requires explicit opt-in and a vision-capable model', () => {
    for (const disabled of [undefined, '', 'false', 'TRUE', '1']) {
      vi.stubEnv('CHAT_COURSE_IMAGE_VISION_ENABLED', disabled)
      expect(courseImageVisionEnabled(true)).toBe(false)
    }
    vi.stubEnv('CHAT_COURSE_IMAGE_VISION_ENABLED', 'true')
    expect(courseImageVisionEnabled(false)).toBe(false)
    expect(courseImageVisionEnabled(true)).toBe(true)
  })

  it('never reads images from history, failed tools or another KB', async () => {
    const read = vi.fn().mockResolvedValue(original)
    const { prepareMessages: prepare } = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: read,
    })
    expect((await prepare(messages, [])).previewCount).toBe(0)
    expect(
      (await prepare(messages, steps(fixture, 'unrelated'))).previewCount
    ).toBe(0)
    expect(
      (await prepare(messages, steps({ ...fixture, isError: true })))
        .previewCount
    ).toBe(0)
    const { prepareMessages: denied } = createCourseImageVision({
      kbIds: [],
      readImage: read,
    })
    expect((await denied(messages, steps())).previewCount).toBe(0)
    expect(read).not.toHaveBeenCalled()
  })

  it('uses retrieval order and bounds reads to three distinct occurrences across concurrent preparation', async () => {
    const read = vi.fn().mockResolvedValue(original)
    const { prepareMessages: prepare } = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: read,
    })
    const input = steps(withAssets(['b', 'a', 'b', 'c', 'd']))
    const [first, second] = await Promise.all([
      prepare(messages, input),
      prepare(messages, input),
    ])
    expect(first.previewCount).toBe(3)
    expect(second.previewCount).toBe(3)
    expect(read.mock.calls.map(([value]) => value.asset_id)).toEqual(
      ['b', 'a', 'c'].map((x) => x.repeat(64))
    )
    expect(
      (await prepare(messages, steps(withAssets(['e'])))).previewCount
    ).toBe(3)
    expect(read).toHaveBeenCalledTimes(3)
    expect(first.messages).toHaveLength(messages.length)
  })

  it('keeps the current search result and persisted tool output free of image bytes', async () => {
    const input = steps()
    const before = JSON.stringify({ messages, input })
    const { prepareMessages: prepare } = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: (value) => readCourseImage(value, root),
    })
    const prepared = await prepare(messages, input)
    expect(prepared.previewCount).toBe(1)
    const content = previewContent(prepared.messages)
    expect(content.map((part) => part.type)).toEqual(['text', 'text', 'file'])
    expect(content[1]).toEqual({
      type: 'text',
      text: expect.stringContaining(image.asset_id),
    })
    expect(
      prepared.messages.filter((message) => message.role === 'user')
    ).toEqual([messages[0]])
    expect(JSON.stringify({ messages, input })).toBe(before)
    expect(mapAssistantStepContent(input)[0]).toMatchObject({ result: fixture })
    expect(JSON.stringify(mapAssistantStepContent(input))).not.toContain(
      'data:image'
    )
  })

  it('falls back to text on validation/decode failure without leaking details or retrying', async () => {
    for (const read of [
      vi.fn().mockRejectedValue(new Error('/private/secret')),
      vi.fn().mockResolvedValue(Buffer.from('not PNG')),
    ]) {
      const { prepareMessages: prepare } = createCourseImageVision({
        kbIds: [image.kb_id],
        readImage: read,
      })
      expect(await prepare(messages, steps())).toEqual({
        messages,
        previewCount: 0,
      })
      await prepare(messages, steps())
      expect(read).toHaveBeenCalledTimes(1)
    }
  })

  it('rejects incorrect dimensions and bounds preview resolution', async () => {
    const large = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: '#fff' },
    })
      .png()
      .toBuffer()
    const payload = structuredClone(fixture)
    const asset = payload.sources[0].chunks[0].visual_assets.assets[0]
    const { prepareMessages: prepareBad } = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: async () => large,
    })
    expect((await prepareBad(messages, steps(payload))).previewCount).toBe(0)
    asset.width_px = 3000
    asset.height_px = 2000
    const { prepareMessages: prepare } = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: async () => large,
    })
    const prepared = await prepare(messages, steps(payload))
    const part = previewContent(prepared.messages).find(
      (part) => part.type === 'file'
    )
    if (
      part?.type !== 'file' ||
      part.data.type !== 'data' ||
      typeof part.data.data !== 'string'
    )
      throw new Error('No pixels')
    const bytes = Buffer.from(part.data.data, 'base64')
    const metadata = await sharp(bytes).metadata()
    expect(metadata.width).toBe(1536)
    expect(metadata.height).toBe(1024)
    expect(bytes.length).toBeLessThanOrEqual(1_000_000)
  })

  it('sends real image content to the SDK continuation while preserving citation and persistence', async () => {
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
              toolCallId: 'search',
              toolName: 'KB_doc_query',
              input: '{}',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage,
          warnings: [],
        },
        {
          content: [{ type: 'text', text: 'Visible flow [1]' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage,
          warnings: [],
        },
      ],
    })
    const { prepareMessages: prepare } = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: (value) => readCourseImage(value, root),
    })
    const response = await generateText({
      model,
      messages: [messages[0]!],
      tools: {
        KB_doc_query: tool({
          inputSchema: z.object({}),
          execute: async () => fixture,
        }),
      },
      stopWhen: isStepCount(2),
      prepareStep: async ({ initialMessages, responseMessages, steps }) => ({
        messages: (
          await prepare(
            [
              ...initialMessages,
              ...withModelCitationIndices(responseMessages, steps),
            ],
            steps
          )
        ).messages,
      }),
    })
    expect(model.doGenerateCalls).toHaveLength(2)
    const request = model.doGenerateCalls[1]!.prompt
    expect(JSON.stringify(request)).toContain('citation_index')
    expect(request.filter((message) => message.role === 'user')).toHaveLength(1)
    const preview = request.at(-1)
    if (preview?.role !== 'tool') throw new Error('Missing visual retrieval')
    const resultPart = preview.content[0]
    if (
      resultPart?.type !== 'tool-result' ||
      resultPart.output.type !== 'content'
    )
      throw new Error('Missing content')
    const pixelPart = resultPart.output.value.find(
      (part) => part.type === 'file'
    )
    expect(pixelPart?.mediaType).toBe('image/png')
    expect(response.steps[0]!.toolResults[0]!.output).toEqual(fixture)
    expect(
      mapAssistantStepContent(response.steps).filter(
        (part) => part.type === 'tool-call'
      )[0]
    ).toMatchObject({ result: fixture })
  })

  it('counts only attached previews and matches the complete figure occurrence', async () => {
    const vision = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: async () => original,
    })
    expect(vision.hasPixelInput(image)).toBe(false)
    // Decoding a candidate without its tool result in model input is not proof.
    expect(
      (await vision.prepareMessages([messages[0]!], steps())).previewCount
    ).toBe(0)
    expect(vision.hasPixelInput(image)).toBe(false)
    await vision.prepareMessages(messages, steps())
    expect(vision.hasPixelInput(image)).toBe(true)
    for (const changed of [
      { kb_id: '00000000-0000-0000-0000-000000000000' },
      { external_resource_id: '00000000-0000-0000-0000-000000000000' },
      { resource_version: image.resource_version + 1 },
      { asset_id: 'f'.repeat(64) },
      { manifest_sha256: 'f'.repeat(64) },
      { image_sha256: 'f'.repeat(64) },
    ]) {
      expect(vision.hasPixelInput({ ...image, ...changed })).toBe(false)
    }
    // A later step without the matching tool result must not reuse stale proof.
    await vision.prepareMessages([messages[0]!], steps())
    expect(vision.hasPixelInput(image)).toBe(false)
  })

  it.each([
    true,
    false,
  ])('persists evidence matching the SDK input before selection (pixels: %s)', async (pixels) => {
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
              toolCallId: 'search',
              toolName: 'KB_doc_query',
              input: '{}',
            },
          ],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage,
          warnings: [],
        },
        {
          content: [
            {
              type: 'tool-call',
              toolCallId: 'choose',
              toolName: 'show_course_image',
              input: JSON.stringify({
                asset_id: image.asset_id,
                reason: 'The flow helps explain the stages.',
              }),
            },
          ],
          finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
          usage,
          warnings: [],
        },
        {
          content: [{ type: 'text', text: 'The stages connect.' }],
          finishReason: { unified: 'stop', raw: 'stop' },
          usage,
          warnings: [],
        },
      ],
    })
    const vision = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: async () =>
        pixels ? original : Buffer.from('invalid preview'),
    })
    const response = await generateText({
      model,
      messages: [messages[0]!],
      tools: withCourseImageTool(
        {
          KB_doc_query: tool({
            inputSchema: z.object({}),
            execute: async () => fixture,
          }),
        },
        [image.kb_id],
        async () => original,
        true,
        vision.hasPixelInput
      ),
      stopWhen: isStepCount(3),
      prepareStep: async ({ initialMessages, responseMessages, steps }) => ({
        messages: (
          await vision.prepareMessages(
            [...initialMessages, ...responseMessages],
            steps
          )
        ).messages,
      }),
    })
    const request = model.doGenerateCalls[1]!.prompt
    const suppliedFiles = request.flatMap((message) =>
      message.role === 'tool'
        ? message.content.flatMap((part) =>
            part.type === 'tool-result' && part.output.type === 'content'
              ? part.output.value.filter((value) => value.type === 'file')
              : []
          )
        : []
    )
    expect(suppliedFiles).toHaveLength(pixels ? 1 : 0)
    const persisted = JSON.parse(
      JSON.stringify(mapAssistantStepContent(response.steps))
    )
    const selection = persisted.find(
      (part: { toolName?: string }) => part.toolName === 'show_course_image'
    )
    expect(selection.result).toMatchObject({
      status: 'selected',
      model_input: pixels ? 'pixels' : 'description_only',
      image,
    })
    expect(JSON.stringify(persisted)).not.toContain(original.toString('base64'))
  })

  it('serializes the preview into an OpenAI Responses image input', async () => {
    const { prepareMessages: prepare } = createCourseImageVision({
      kbIds: [image.kb_id],
      readImage: (value) => readCourseImage(value, root),
    })
    const prepared = await prepare(messages, steps())
    const captures: Record<string, unknown>[] = []
    const provider = createOpenAI({
      apiKey: 'test-key',
      baseURL: 'https://example.test/v1',
      fetch: async (_url, init) => {
        captures.push(JSON.parse(String(init?.body)))
        return Response.json({
          id: 'test-response',
          object: 'response',
          created_at: 1,
          status: 'completed',
          model: 'test-model',
          output: [
            {
              type: 'message',
              role: 'assistant',
              id: 'test-message',
              status: 'completed',
              content: [
                { type: 'output_text', text: 'Visible flow.', annotations: [] },
              ],
            },
          ],
          usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
        })
      },
    })
    await generateText({
      model: provider.responses('test-model'),
      messages: prepared.messages,
      maxRetries: 0,
    })
    expect(captures).toHaveLength(1)
    expect(captures[0]!.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function_call_output',
          output: expect.arrayContaining([
            expect.objectContaining({
              type: 'input_image',
              image_url: expect.stringMatching(/^data:image\/png;base64,/),
            }),
          ]),
        }),
      ])
    )
  })
})
