import {
  CHAT_ENGINE_CONTRACT_VERSION,
  type EngineChatRequest,
  type EngineManifest,
  type EngineStreamPart,
} from './schema.js'

export const conformanceRequest: EngineChatRequest = {
  contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
  requestId: 'request-1',
  participantId: 'participant-1',
  courseId: 'course-1',
  chatbotId: 'chatbot-1',
  threadId: 'thread-1',
  userMessageId: 'user-1',
  assistantMessageId: 'assistant-1',
  runId: 'run-1',
  locale: 'en',
  systemPrompt: 'Answer briefly.',
  generation: {
    modelId: 'gpt-4.1-mini',
    deploymentId: 'gpt-4.1-mini',
    reasoningEffort: 'none',
    reasoningSummary: 'none',
    responseStorage: false,
    credentialMode: {
      mode: 'deployment',
    },
  },
  messages: [
    {
      id: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'What is a bond?' }],
    },
  ],
  tools: [],
}

export const conformanceRequestCredentialRequest: EngineChatRequest = {
  ...conformanceRequest,
  requestId: 'request-credential-1',
  generation: {
    ...conformanceRequest.generation,
    credentialMode: {
      mode: 'gateway',
      gatewayOrigin: 'https://provider.example.test/v1',
    },
  },
}

export const conformanceToolRequest: EngineChatRequest = {
  ...conformanceRequest,
  requestId: 'request-tool-1',
  tools: [
    {
      name: 'doc_query',
      description: 'Search approved course documents.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
      serverId: 'doc-server',
    },
  ],
}

export const conformanceAbortRequest: EngineChatRequest = {
  ...conformanceRequest,
  requestId: 'request-abort-1',
}

export const conformanceStream: EngineStreamPart[] = [
  { type: 'start', messageId: 'assistant-1' },
  { type: 'text-start', id: 'text-1' },
  { type: 'text-delta', id: 'text-1', delta: 'A bond is debt.' },
  { type: 'text-end', id: 'text-1' },
  {
    type: 'finish',
    finishReason: 'stop',
    messageMetadata: {
      contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
      engineId: 'conformance-engine',
      runId: 'run-1',
      modelId: 'gpt-4.1-mini',
      deploymentId: 'gpt-4.1-mini',
      usage: {
        inputTokens: 12,
        outputTokens: 8,
        reasoningTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        totalTokens: 20,
      },
      reasoningContent: null,
      aborted: false,
    },
  },
]

export const conformanceToolStream: EngineStreamPart[] = [
  { type: 'start', messageId: 'assistant-1' },
  { type: 'start-step' },
  {
    type: 'tool-input-start',
    toolCallId: 'call-2',
    toolName: 'doc_query',
    providerToolCallIndex: 2,
  },
  {
    type: 'tool-input-available',
    toolCallId: 'call-2',
    toolName: 'doc_query',
    input: { query: 'bond' },
    providerToolCallIndex: 2,
  },
  {
    type: 'tool-output-available',
    toolCallId: 'call-2',
    output: { text: 'A bond is debt.' },
    providerToolCallIndex: 2,
  },
  { type: 'finish-step' },
  { type: 'text-start', id: 'text-1' },
  { type: 'text-delta', id: 'text-1', delta: 'A bond is debt.' },
  { type: 'text-end', id: 'text-1' },
  {
    type: 'finish',
    finishReason: 'stop',
    messageMetadata: {
      contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
      engineId: 'conformance-engine',
      runId: 'run-1',
      modelId: 'gpt-4.1-mini',
      deploymentId: 'gpt-4.1-mini',
      usage: {
        inputTokens: 12,
        outputTokens: 8,
        reasoningTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        totalTokens: 20,
      },
      reasoningContent: null,
      aborted: false,
    },
  },
]

export const conformanceAbortStream: EngineStreamPart[] = [
  { type: 'start', messageId: 'assistant-1' },
  { type: 'text-start', id: 'text-1' },
  { type: 'text-delta', id: 'text-1', delta: 'A bond is' },
  {
    type: 'message-metadata',
    messageMetadata: {
      contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
      engineId: 'conformance-engine',
      runId: 'run-1',
      modelId: 'gpt-4.1-mini',
      deploymentId: 'gpt-4.1-mini',
      usage: {
        inputTokens: 12,
        outputTokens: 4,
        reasoningTokens: null,
        cacheReadTokens: null,
        cacheWriteTokens: null,
        totalTokens: 16,
      },
      reasoningContent: null,
      aborted: true,
    },
  },
  { type: 'abort', reason: 'client cancelled' },
]

export const conformanceManifest: EngineManifest = {
  contractVersion: CHAT_ENGINE_CONTRACT_VERSION,
  engineId: 'conformance-engine',
  features: {
    text: true,
    reasoning: true,
    images: true,
    tools: true,
    cancellation: true,
  },
  providerCredentialModes: ['gateway', 'deployment'],
  limits: {
    maxMessages: 100,
    maxTools: 64,
    maxImageAttachments: 3,
    maxDecodedImageBytes: 5 * 1024 * 1024,
    maxDataUrlLength: 7_000_000,
  },
}
