import { describe, expect, test } from 'vitest'
import {
  CHAT_ENGINE_CONTRACT_V2,
  CHAT_ENGINE_CONTRACT_VERSION,
  CHAT_ENGINE_MAX_V2_REQUEST_BYTES,
  conformanceAbortRequest,
  conformanceAbortStream,
  conformanceManifest,
  conformanceRequest,
  conformanceRequestCredentialRequest,
  conformanceStream,
  conformanceToolRequest,
  conformanceToolStream,
  conformanceV2AbortRequest,
  conformanceV2Manifest,
  conformanceV2Request,
  conformanceV2RequestCredentialRequest,
  conformanceV2ToolRequest,
  engineChatRequestSchema,
  engineManifestSchema,
  engineModelToolOutputSchema,
  engineStreamPartSchema,
  engineToolExecutionV2ResultSchema,
  engineV2ChatRequestSchema,
  engineV2StreamPartSchema,
  parseEngineChatRequest,
  parseEngineManifest,
  parseEngineStreamPart,
  parseProviderAllowedOrigins,
  providerOriginIsAllowed,
  validateProviderCredentialHeaders,
} from '../src/index.js'

describe('chat engine contract', () => {
  test('accepts the conformance requests and stream fixtures', () => {
    for (const request of [
      conformanceRequest,
      conformanceRequestCredentialRequest,
      conformanceToolRequest,
      conformanceAbortRequest,
    ]) {
      expect(engineChatRequestSchema.parse(request)).toEqual(request)
    }
    expect(
      conformanceStream.map((part) => parseEngineStreamPart(part))
    ).toEqual(conformanceStream)
    expect(
      conformanceToolStream.map((part) => parseEngineStreamPart(part))
    ).toEqual(conformanceToolStream)
    expect(
      conformanceAbortStream.map((part) => parseEngineStreamPart(part))
    ).toEqual(conformanceAbortStream)
    expect(engineManifestSchema.parse(conformanceManifest)).toEqual(
      conformanceManifest
    )
  })

  test('preserves nested tool schemas and provider metadata as JSON records', () => {
    const inputSchema = {
      type: 'object',
      properties: { code: { type: 'string', maxLength: 2000 } },
      required: ['code'],
      additionalProperties: false,
      'x-provider': { enabled: true, options: [null, 1, 'value'] },
    }
    const request = {
      ...conformanceToolRequest,
      tools: [{ ...conformanceToolRequest.tools[0], inputSchema }],
    }
    expect(engineChatRequestSchema.parse(request)).toEqual(request)
    const part = {
      type: 'text-delta',
      id: 'part-1',
      delta: 'answer',
      providerMetadata: { vendor: { cached: true, details: [null, 1] } },
    }
    expect(parseEngineStreamPart(part)).toEqual(part)
    expect(
      engineStreamPartSchema.safeParse({ ...part, providerMetadata: [] })
        .success
    ).toBe(false)
  })

  test.each([
    [0, true],
    [Number.MAX_SAFE_INTEGER + 1, true],
    [-1, false],
    [1.5, false],
    [Number.POSITIVE_INFINITY, false],
  ])('preserves protocol integer validation for %s', (value, accepted) => {
    expect(
      engineStreamPartSchema.safeParse({
        type: 'tool-input-delta',
        toolCallId: 'call-1',
        inputTextDelta: '{}',
        providerToolCallIndex: value,
      }).success
    ).toBe(accepted)
    const finish = conformanceStream.find((part) => part.type === 'finish')!
    expect(
      engineStreamPartSchema.safeParse({
        ...finish,
        messageMetadata: {
          ...finish.messageMetadata,
          usage: { ...finish.messageMetadata.usage, inputTokens: value },
        },
      }).success
    ).toBe(accepted)
  })

  test('keeps W3C trace context out of the JSON request', () => {
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        traceContext: {
          traceparent:
            '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
        },
      }).success
    ).toBe(false)
  })

  test('requires exactly one explicit provider credential mode', () => {
    const requestMode = {
      ...conformanceRequest,
      generation: {
        ...conformanceRequest.generation,
        credentialMode: {
          mode: 'gateway' as const,
          gatewayOrigin: 'https://openrouter.ai/api/v1',
        },
      },
    }
    const headers = new Headers({
      'provider-authorization': 'Bearer request-secret',
    })

    expect(engineChatRequestSchema.parse(requestMode).contractVersion).toBe(
      CHAT_ENGINE_CONTRACT_VERSION
    )
    expect(
      validateProviderCredentialHeaders(requestMode.generation, headers)
    ).toEqual({
      ok: true,
      providerApiKey: 'request-secret',
    })
    expect(
      engineChatRequestSchema.safeParse({
        ...requestMode,
        generation: {
          ...requestMode.generation,
          credentialMode: {
            mode: 'gateway',
            gatewayOrigin: 'https://openrouter.ai/api/v1?key=embedded',
          },
        },
      }).success
    ).toBe(false)
    expect(
      validateProviderCredentialHeaders(conformanceRequest.generation, headers)
    ).toEqual({
      ok: false,
      message:
        'Provider-Authorization is not allowed for deployment credentials.',
    })
  })

  test('rejects unknown generation options and invalid stream parts', () => {
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        generation: {
          ...conformanceRequest.generation,
          fallback: true,
        },
      }).success
    ).toBe(false)
    expect(
      engineStreamPartSchema.safeParse({
        type: 'tool-input-available',
        toolCallId: 'call-1',
        toolName: 'doc_query',
      }).success
    ).toBe(false)
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        messages: [
          {
            ...conformanceRequest.messages[0],
            parts: [{ type: 'text', text: 'question', extra: true }],
          },
        ],
      }).success
    ).toBe(false)
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        tools: [
          {
            name: 'doc_query',
            inputSchema: { type: 'object' },
            serverId: 'server-1',
          },
          {
            name: 'doc_query',
            inputSchema: { type: 'object' },
            serverId: 'server-2',
          },
        ],
      }).success
    ).toBe(false)
  })

  test('enforces the decoded image limit and data-url guard', () => {
    const image = {
      id: 'image-1',
      type: 'image' as const,
      mediaType: 'image/png' as const,
      dataUrl: `data:image/png;base64,${'A'.repeat(7_000_001)}`,
    }
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        messages: [
          {
            ...conformanceRequest.messages[0],
            parts: [image],
          },
        ],
      }).success
    ).toBe(false)

    const decodedLimitImage = {
      id: 'image-2',
      type: 'image' as const,
      mediaType: 'image/png' as const,
      dataUrl: `data:image/png;base64,${'A'.repeat(6_999_000)}`,
    }
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        messages: [
          {
            ...conformanceRequest.messages[0],
            parts: [decodedLimitImage],
          },
        ],
      }).success
    ).toBe(false)
  })

  test('enforces the manifest image count and user-only image history', () => {
    const image = {
      id: 'image-1',
      type: 'image' as const,
      mediaType: 'image/png' as const,
      dataUrl: 'data:image/png;base64,AA==',
    }
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        messages: [
          {
            id: 'user-images',
            role: 'user',
            parts: [image, image, image, image],
          },
        ],
      }).success
    ).toBe(false)
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        messages: [
          { id: 'assistant-image', role: 'assistant', parts: [image] },
        ],
      }).success
    ).toBe(false)
  })

  test('keeps v1 defaults strict while accepting explicit v2 fixtures', () => {
    for (const request of [
      conformanceV2Request,
      conformanceV2RequestCredentialRequest,
      conformanceV2ToolRequest,
      conformanceV2AbortRequest,
    ]) {
      expect(parseEngineChatRequest(request, CHAT_ENGINE_CONTRACT_V2)).toEqual(
        request
      )
      expect(() => parseEngineChatRequest(request)).toThrow()
    }
    expect(parseEngineChatRequest(conformanceRequest)).toEqual(
      conformanceRequest
    )
    expect(() =>
      parseEngineChatRequest(conformanceRequest, CHAT_ENGINE_CONTRACT_V2)
    ).toThrow()
    expect(
      parseEngineManifest(conformanceV2Manifest, CHAT_ENGINE_CONTRACT_V2)
    ).toEqual(conformanceV2Manifest)
    expect(() => parseEngineManifest(conformanceV2Manifest)).toThrow()
    expect(() =>
      parseEngineManifest(conformanceManifest, CHAT_ENGINE_CONTRACT_V2)
    ).toThrow()
    expect(conformanceV2Manifest.limits.maxRequestBytes).toBe(
      CHAT_ENGINE_MAX_V2_REQUEST_BYTES
    )

    const finish = conformanceStream.find((part) => part.type === 'finish')!
    const v2Finish = {
      ...finish,
      messageMetadata: {
        ...finish.messageMetadata,
        contractVersion: CHAT_ENGINE_CONTRACT_V2,
      },
    }
    expect(parseEngineStreamPart(v2Finish, CHAT_ENGINE_CONTRACT_V2)).toEqual(
      v2Finish
    )
    expect(() => parseEngineStreamPart(v2Finish)).toThrow()
    expect(() =>
      parseEngineStreamPart(finish, CHAT_ENGINE_CONTRACT_V2)
    ).toThrow()
    expect(
      engineV2StreamPartSchema.safeParse({
        type: 'start',
        messageMetadata: finish.messageMetadata,
      }).success
    ).toBe(false)
    expect(
      engineV2StreamPartSchema.safeParse({
        type: 'message-metadata',
        messageMetadata: finish.messageMetadata,
      }).success
    ).toBe(false)
    expect(
      engineChatRequestSchema.safeParse({
        ...conformanceRequest,
        messages: [
          {
            ...conformanceRequest.messages[0],
            parts: [
              {
                type: 'image',
                id: 'image-1',
                source: 'attachment',
                mediaType: 'image/png',
                dataUrl: 'data:image/png;base64,AA==',
              },
            ],
          },
        ],
      }).success
    ).toBe(false)
  })

  test('separately bounds ordinary images and current JPEG document pages', () => {
    const image = {
      type: 'image' as const,
      id: 'image',
      source: 'attachment' as const,
      mediaType: 'image/png' as const,
      dataUrl: 'data:image/png;base64,AA==',
    }
    const page = {
      type: 'image' as const,
      id: 'page',
      source: 'document-page' as const,
      mediaType: 'image/jpeg' as const,
      dataUrl: 'data:image/jpeg;base64,AA==',
    }
    const request = (parts: unknown[], priorParts: unknown[] = []) => ({
      ...conformanceV2Request,
      messages: [
        ...(priorParts.length
          ? [{ id: 'prior', role: 'user', parts: priorParts }]
          : []),
        { id: conformanceV2Request.userMessageId, role: 'user', parts },
      ],
    })
    expect(
      engineV2ChatRequestSchema.safeParse(
        request([...Array(3).fill(image), ...Array(10).fill(page)])
      ).success
    ).toBe(true)
    expect(
      engineV2ChatRequestSchema.safeParse(
        request([image], [image, image, image])
      ).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse(request(Array(11).fill(page))).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse(request([image], [page])).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse({
        ...request([page]),
        userMessageId: 'another-user',
      }).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse({
        ...request([page]),
        messages: [
          {
            id: conformanceV2Request.userMessageId,
            role: 'assistant',
            parts: [page],
          },
        ],
      }).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse(
        request([{ ...page, mediaType: 'image/png', dataUrl: image.dataUrl }])
      ).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse(
        request([
          {
            ...page,
            dataUrl: `data:image/jpeg;base64,${'A'.repeat(2_000_000)}`,
          },
        ])
      ).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse(
        request([{ ...image, source: undefined }])
      ).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse(
        request([
          {
            ...image,
            dataUrl: `data:image/png;base64,${'A'.repeat(6_999_000)}`,
          },
        ])
      ).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse(
        request([
          { type: 'text', text: 'a'.repeat(200_000) },
          { type: 'text', text: 'b'.repeat(200_000) },
        ])
      ).success
    ).toBe(true)
    expect(
      engineV2ChatRequestSchema.safeParse(
        request([{ type: 'text', text: 'a'.repeat(200_001) }])
      ).success
    ).toBe(false)
    expect(
      engineV2ChatRequestSchema.safeParse({
        ...conformanceV2ToolRequest,
        tools: [
          ...conformanceV2ToolRequest.tools,
          ...conformanceV2ToolRequest.tools,
        ],
      }).success
    ).toBe(false)
  })

  test('keeps tagged model projections distinct from original tool output', () => {
    const raw = { sources: [{ id: 'source-1' }] }
    const projections = [
      {
        type: 'text',
        value: 'model text',
        providerOptions: { vendor: { enabled: true } },
      },
      {
        type: 'content',
        value: [
          { type: 'text', text: 'model text' },
          { type: 'image-data', data: 'AA==', mediaType: 'image/png' },
        ],
      },
      { type: 'json', value: { answer: 1 } },
      { type: 'error-text', value: 'unavailable' },
      { type: 'error-json', value: { code: 'failed' } },
      { type: 'execution-denied', reason: 'denied' },
    ]
    for (const modelOutput of projections) {
      expect(engineModelToolOutputSchema.parse(modelOutput)).toEqual(
        modelOutput
      )
      const envelope = { output: raw, modelOutput }
      expect(engineToolExecutionV2ResultSchema.parse(envelope)).toEqual(
        envelope
      )
      const toolCall = {
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'doc_query',
        output: raw,
        modelOutput,
      }
      const history = {
        ...conformanceV2Request,
        messages: [
          { id: 'assistant', role: 'assistant', parts: [toolCall] },
          conformanceV2Request.messages[0],
        ],
      }
      expect(engineV2ChatRequestSchema.parse(history)).toEqual(history)
      expect(
        engineChatRequestSchema.safeParse({
          ...history,
          contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
        }).success
      ).toBe(false)
      expect(
        engineV2ChatRequestSchema.safeParse({
          ...history,
          messages: [{ id: 'user', role: 'user', parts: [toolCall] }],
        }).success
      ).toBe(false)
      expect(
        engineV2StreamPartSchema.safeParse({
          type: 'tool-output-available',
          toolCallId: 'call-1',
          output: raw,
          modelOutput,
        }).success
      ).toBe(false)
      expect(
        engineV2StreamPartSchema.parse({
          type: 'tool-output-available',
          toolCallId: 'call-1',
          output: raw,
        })
      ).toEqual({
        type: 'tool-output-available',
        toolCallId: 'call-1',
        output: raw,
      })
    }
    expect(engineToolExecutionV2ResultSchema.safeParse({}).success).toBe(false)
    expect(
      engineToolExecutionV2ResultSchema.safeParse({ output: undefined }).success
    ).toBe(false)
    expect(
      engineToolExecutionV2ResultSchema.safeParse({ output: null }).success
    ).toBe(true)
    expect(
      engineToolExecutionV2ResultSchema.safeParse({ output: raw, extra: true })
        .success
    ).toBe(false)
    expect(
      engineModelToolOutputSchema.safeParse({ type: 'json' }).success
    ).toBe(false)
    expect(
      engineModelToolOutputSchema.safeParse({
        type: 'error-json',
        value: undefined,
      }).success
    ).toBe(false)
    expect(
      engineModelToolOutputSchema.safeParse({
        type: 'text',
        value: 'x'.repeat(200_001),
      }).success
    ).toBe(false)
    expect(
      engineModelToolOutputSchema.safeParse({ type: 'content', value: [{}] })
        .success
    ).toBe(false)
    expect(
      engineModelToolOutputSchema.safeParse({
        type: 'content',
        value: Array(257).fill({ type: 'text' }),
      }).success
    ).toBe(false)
    expect(
      engineModelToolOutputSchema.safeParse({
        type: 'text',
        value: 'ok',
        extra: true,
      }).success
    ).toBe(false)
  })

  test('parses exact provider origins and rejects URL-shaped allowlist entries', () => {
    const origins = parseProviderAllowedOrigins(
      'https://provider.example.test, http://litellm.example.test:4000'
    )
    expect([...origins]).toEqual([
      'https://provider.example.test',
      'http://litellm.example.test:4000',
    ])
    expect(
      providerOriginIsAllowed('https://provider.example.test/v1', origins)
    ).toBe(true)
    expect(
      providerOriginIsAllowed('https://untrusted.example.test/v1', origins)
    ).toBe(false)
    expect(() =>
      parseProviderAllowedOrigins('https://provider.example.test/v1')
    ).toThrow('exact HTTP origins')
  })
})
