import { describe, expect, test } from 'vitest'
import {
  CHAT_ENGINE_CONTRACT_VERSION,
  conformanceAbortRequest,
  conformanceAbortStream,
  conformanceManifest,
  conformanceRequest,
  conformanceRequestCredentialRequest,
  conformanceStream,
  conformanceToolRequest,
  conformanceToolStream,
  engineChatRequestSchema,
  engineManifestSchema,
  engineStreamPartSchema,
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
          mode: 'request' as const,
          providerBaseUrl: 'https://openrouter.ai/api/v1',
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
            mode: 'request',
            providerBaseUrl: 'https://openrouter.ai/api/v1?key=embedded',
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
