type Mode = 'chat' | 'responses'
type ProbeKind = 'primary' | 'secondary-chat' | 'preview-fallback'

type CliOptions = {
  mode: Mode
  baseUrlArg?: string
  deployment: string
  deploymentProvided: boolean
  apiVersion?: string
  prompt: string
  stream: boolean
  verbose: boolean
  allModels: boolean
  allModelsExplicit: boolean
  modelId?: string
  alsoChat: boolean
  probePreviewOnFail: boolean
  json: boolean
}

type ModelConfig = {
  id: string
  deploymentId: string
  name: string
  apiVersion: string
}

type ProbeTarget = {
  modelId: string
  deploymentId: string
  apiVersion: string
}

type ProbeResult = {
  modelId: string
  deploymentId: string
  mode: Mode
  apiVersion: string
  ok: boolean
  statusCode: number | null
  errorCode: string | null
  errorMessage: string | null
  textPreview: string
  required: boolean
  kind: ProbeKind
  apiVersionNotSupported: boolean
}

type ProbeRequest = {
  target: ProbeTarget
  baseUrl: string
  apiKey: string
  prompt: string
  stream: boolean
  verbose: boolean
  required: boolean
  kind: ProbeKind
}

const DEFAULT_BASE_URL = 'https://klicker-ai.cognitiveservices.azure.com/openai'
const PREVIEW_API_VERSION = 'preview'

// Keep this list in sync with apps/chat/src/lib/server/chatModelRegistry.ts defaults.
const DEFAULT_MODEL_REGISTRY: ModelConfig[] = [
  {
    id: 'gpt-4.1',
    deploymentId: 'gpt-4.1',
    name: 'GPT-4.1',
    apiVersion: 'preview',
  },
  {
    id: 'gpt-5.1',
    deploymentId: 'gpt-5.1',
    name: 'GPT-5.1',
    apiVersion: 'preview',
  },
  {
    id: 'gpt-4.1-mini',
    deploymentId: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    apiVersion: 'preview',
  },
]

function printHelp() {
  console.log(`Usage: tsx util/azureOpenAiTest.ts [options]

Options:
  --mode <responses|chat>       Primary probe mode (default: responses)
  --base-url <url>              Azure OpenAI base URL (default: from AZURE_RESOURCE_NAME)
  --all-models                  Test all models from registry (default: true)
  --no-all-models               Disable all-model probing
  --model <id>                  Probe one model by registry id
  --deployment <name>           Probe one deployment directly (legacy mode)
  --api-version <version>       Override API version (optional in registry mode)
  --also-chat                   Run chat/completions after primary responses check
  --probe-preview-on-fail       Retry failed primary responses probe with api-version=preview
  --prompt <text>               Prompt text (default: "This is a test.")
  --stream                      Enable streaming (default)
  --no-stream                   Disable streaming
  --json                        Emit machine-readable JSON results only
  --verbose                     Print SSE events
  -h, --help                    Show this help
`)
}

function requireArgValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'responses',
    deployment: 'gpt-5.1',
    deploymentProvided: false,
    prompt: 'This is a test.',
    stream: true,
    verbose: false,
    allModels: true,
    allModelsExplicit: false,
    alsoChat: false,
    probePreviewOnFail: false,
    json: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--mode': {
        const value = requireArgValue(argv, i, arg)
        if (value !== 'chat' && value !== 'responses') {
          throw new Error(`Invalid value for --mode: ${value}`)
        }
        options.mode = value
        i += 1
        break
      }
      case '--base-url': {
        options.baseUrlArg = requireArgValue(argv, i, arg)
        i += 1
        break
      }
      case '--deployment': {
        options.deployment = requireArgValue(argv, i, arg)
        options.deploymentProvided = true
        i += 1
        break
      }
      case '--api-version': {
        options.apiVersion = requireArgValue(argv, i, arg)
        i += 1
        break
      }
      case '--model': {
        options.modelId = requireArgValue(argv, i, arg)
        i += 1
        break
      }
      case '--prompt': {
        options.prompt = requireArgValue(argv, i, arg)
        i += 1
        break
      }
      case '--all-models': {
        options.allModels = true
        options.allModelsExplicit = true
        break
      }
      case '--no-all-models': {
        options.allModels = false
        options.allModelsExplicit = true
        break
      }
      case '--also-chat': {
        options.alsoChat = true
        break
      }
      case '--probe-preview-on-fail': {
        options.probePreviewOnFail = true
        break
      }
      case '--no-stream': {
        options.stream = false
        break
      }
      case '--stream': {
        options.stream = true
        break
      }
      case '--verbose': {
        options.verbose = true
        break
      }
      case '--json': {
        options.json = true
        break
      }
      case '-h':
      case '--help': {
        printHelp()
        process.exit(0)
      }
      default: {
        throw new Error(`Unknown argument: ${arg}`)
      }
    }
  }

  if (options.modelId && options.allModels && options.allModelsExplicit) {
    throw new Error('Cannot use --model together with --all-models')
  }

  if (options.modelId) {
    options.allModels = false
  }

  // Backward compatibility:
  // if deployment is provided and user did not explicitly choose all-models, run single deployment.
  if (
    options.deploymentProvided &&
    !options.allModelsExplicit &&
    !options.modelId
  ) {
    options.allModels = false
  }

  if (options.mode === 'chat' && options.probePreviewOnFail) {
    console.warn(
      '[warn] --probe-preview-on-fail only applies to primary responses probes.'
    )
  }

  return options
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

function resolveBaseUrl(baseUrlArg?: string) {
  if (baseUrlArg) {
    return normalizeBaseUrl(baseUrlArg)
  }

  const resourceName = process.env.AZURE_RESOURCE_NAME
  if (resourceName) {
    return normalizeBaseUrl(
      `https://${resourceName}.cognitiveservices.azure.com/openai`
    )
  }

  return normalizeBaseUrl(DEFAULT_BASE_URL)
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function parseModelRegistry(raw: string): ModelConfig[] {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error('CHAT_MODEL_REGISTRY_JSON must be an array')
  }

  return parsed.map((entry, index) => {
    const item = asObject(entry)
    if (!item) {
      throw new Error(`Invalid model entry at index ${index}`)
    }

    const id = item.id
    const deploymentId = item.deploymentId
    const name = item.name
    const apiVersion = item.apiVersion

    if (
      typeof id !== 'string' ||
      typeof deploymentId !== 'string' ||
      typeof name !== 'string' ||
      typeof apiVersion !== 'string'
    ) {
      throw new Error(`Invalid model entry fields at index ${index}`)
    }

    return { id, deploymentId, name, apiVersion }
  })
}

function loadModelRegistry(): ModelConfig[] {
  const raw = process.env.CHAT_MODEL_REGISTRY_JSON
  if (!raw) {
    return DEFAULT_MODEL_REGISTRY
  }

  try {
    return parseModelRegistry(raw)
  } catch (error) {
    console.warn(
      '[warn] Invalid CHAT_MODEL_REGISTRY_JSON, falling back to defaults:',
      error
    )
    return DEFAULT_MODEL_REGISTRY
  }
}

function resolveTargets(
  options: CliOptions,
  registry: ModelConfig[]
): ProbeTarget[] {
  if (options.modelId) {
    const model = registry.find((entry) => entry.id === options.modelId)
    if (!model) {
      throw new Error(`Model id not found in registry: ${options.modelId}`)
    }
    return [
      {
        modelId: model.id,
        deploymentId: model.deploymentId,
        apiVersion: options.apiVersion || model.apiVersion,
      },
    ]
  }

  if (options.allModels) {
    return registry.map((entry) => ({
      modelId: entry.id,
      deploymentId: entry.deploymentId,
      apiVersion: options.apiVersion || entry.apiVersion,
    }))
  }

  const matchedModel = registry.find(
    (entry) =>
      entry.deploymentId === options.deployment ||
      entry.id === options.deployment
  )
  const apiVersion = options.apiVersion || matchedModel?.apiVersion
  if (!apiVersion) {
    throw new Error(
      'Missing API version for single deployment mode. Pass --api-version or use a deployment defined in CHAT_MODEL_REGISTRY_JSON.'
    )
  }

  return [
    {
      modelId: matchedModel?.id || options.deployment,
      deploymentId: options.deployment,
      apiVersion,
    },
  ]
}

function extractTextPart(part: unknown): string | null {
  const partObject = asObject(part)
  if (!partObject) return null

  if (typeof partObject.text === 'string') {
    return partObject.text
  }

  const nestedText = asObject(partObject.text)
  if (nestedText && typeof nestedText.value === 'string') {
    return nestedText.value
  }

  if (typeof partObject.output_text === 'string') {
    return partObject.output_text
  }

  return null
}

function extractResponsesText(payload: unknown): string {
  const json = asObject(payload)
  if (!json) return ''

  if (typeof json.output_text === 'string') {
    return json.output_text
  }

  const output = json.output
  if (!Array.isArray(output)) return ''

  const fragments: string[] = []
  for (const item of output) {
    const itemObject = asObject(item)
    if (!itemObject) continue

    const content = itemObject.content
    if (!Array.isArray(content)) continue

    for (const part of content) {
      const text = extractTextPart(part)
      if (text) {
        fragments.push(text)
      }
    }
  }

  return fragments.join('')
}

function previewText(value: string, maxLength = 120): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) return compact
  return `${compact.slice(0, maxLength - 3)}...`
}

function stringifyBody(json: unknown, rawText: string): string {
  if (json !== null) {
    return JSON.stringify(json)
  }
  return rawText
}

async function readBody(response: Response): Promise<{
  rawText: string
  json: unknown | null
}> {
  const rawText = await response.text()
  if (!rawText) {
    return { rawText: '', json: null }
  }

  try {
    return { rawText, json: JSON.parse(rawText) }
  } catch {
    return { rawText, json: null }
  }
}

function parseErrorCodeAndMessage(payload: unknown): {
  errorCode: string | null
  errorMessage: string | null
} {
  const body = asObject(payload)
  if (!body) {
    return { errorCode: null, errorMessage: null }
  }

  const nestedError = asObject(body.error)
  if (nestedError) {
    return {
      errorCode: typeof nestedError.code === 'string' ? nestedError.code : null,
      errorMessage:
        typeof nestedError.message === 'string' ? nestedError.message : null,
    }
  }

  return {
    errorCode: typeof body.code === 'string' ? body.code : null,
    errorMessage: typeof body.message === 'string' ? body.message : null,
  }
}

function isApiVersionNotSupported(errorMessage: string | null): boolean {
  if (!errorMessage) return false
  return /api version not supported/i.test(errorMessage)
}

async function streamChatCompletions(
  response: Response,
  verbose: boolean
): Promise<{ text: string }> {
  const reader = response.body?.getReader()
  if (!reader) {
    return { text: '' }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') {
        return { text }
      }

      try {
        const data = JSON.parse(payload)
        if (verbose) {
          console.log('[event]', data)
        }
        const delta = data?.choices?.[0]?.delta?.content
        if (typeof delta === 'string') {
          text += delta
        }
      } catch (error) {
        if (verbose) {
          console.warn('[warn] Failed to parse SSE payload:', error)
        }
      }
    }
  }

  return { text }
}

async function streamResponses(
  response: Response,
  verbose: boolean
): Promise<{ text: string }> {
  const reader = response.body?.getReader()
  if (!reader) {
    return { text: '' }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data: ')) continue

      const payload = line.slice(6)
      if (payload === '[DONE]') {
        return { text }
      }

      try {
        const data = JSON.parse(payload)
        if (verbose) {
          console.log('[event]', data)
        }

        if (data?.type === 'response.output_text.delta') {
          if (typeof data.delta === 'string') {
            text += data.delta
          } else if (typeof data.text === 'string') {
            text += data.text
          }
        }

        if (data?.type === 'response.completed' && !text) {
          text = extractResponsesText(data.response)
        }
      } catch (error) {
        if (verbose) {
          console.warn('[warn] Failed to parse SSE payload:', error)
        }
      }
    }
  }

  return { text }
}

async function probeResponses(request: ProbeRequest): Promise<ProbeResult> {
  const url = `${request.baseUrl}/v1/responses?api-version=${encodeURIComponent(
    request.target.apiVersion
  )}`
  const body = {
    model: request.target.deploymentId,
    input: request.prompt,
    stream: request.stream,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': request.apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const { rawText, json } = await readBody(response)
    const { errorCode, errorMessage } = parseErrorCodeAndMessage(json)
    return {
      modelId: request.target.modelId,
      deploymentId: request.target.deploymentId,
      mode: 'responses',
      apiVersion: request.target.apiVersion,
      ok: false,
      statusCode: response.status,
      errorCode,
      errorMessage: errorMessage || stringifyBody(json, rawText),
      textPreview: '',
      required: request.required,
      kind: request.kind,
      apiVersionNotSupported: isApiVersionNotSupported(errorMessage),
    }
  }

  const text = request.stream
    ? (await streamResponses(response, request.verbose)).text
    : extractResponsesText(await response.json())

  return {
    modelId: request.target.modelId,
    deploymentId: request.target.deploymentId,
    mode: 'responses',
    apiVersion: request.target.apiVersion,
    ok: true,
    statusCode: response.status,
    errorCode: null,
    errorMessage: null,
    textPreview: previewText(text),
    required: request.required,
    kind: request.kind,
    apiVersionNotSupported: false,
  }
}

async function probeChat(request: ProbeRequest): Promise<ProbeResult> {
  const url = `${request.baseUrl}/deployments/${encodeURIComponent(
    request.target.deploymentId
  )}/chat/completions?api-version=${encodeURIComponent(
    request.target.apiVersion
  )}`
  const body = {
    messages: [{ role: 'user', content: request.prompt }],
    stream: request.stream,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': request.apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const { rawText, json } = await readBody(response)
    const { errorCode, errorMessage } = parseErrorCodeAndMessage(json)
    return {
      modelId: request.target.modelId,
      deploymentId: request.target.deploymentId,
      mode: 'chat',
      apiVersion: request.target.apiVersion,
      ok: false,
      statusCode: response.status,
      errorCode,
      errorMessage: errorMessage || stringifyBody(json, rawText),
      textPreview: '',
      required: request.required,
      kind: request.kind,
      apiVersionNotSupported: isApiVersionNotSupported(errorMessage),
    }
  }

  const text = request.stream
    ? (await streamChatCompletions(response, request.verbose)).text
    : ((await response.json())?.choices?.[0]?.message?.content ?? '')

  return {
    modelId: request.target.modelId,
    deploymentId: request.target.deploymentId,
    mode: 'chat',
    apiVersion: request.target.apiVersion,
    ok: true,
    statusCode: response.status,
    errorCode: null,
    errorMessage: null,
    textPreview: previewText(text),
    required: request.required,
    kind: request.kind,
    apiVersionNotSupported: false,
  }
}

function pad(value: string, width: number): string {
  return `${value}${' '.repeat(Math.max(0, width - value.length))}`
}

function printTable(results: ProbeResult[]) {
  const headers = [
    'modelId',
    'deploymentId',
    'probe',
    'mode',
    'apiVersion',
    'result',
    'status',
    'error',
    'textPreview',
  ]

  const rows = results.map((result) => [
    result.modelId,
    result.deploymentId,
    result.kind,
    result.mode,
    result.apiVersion,
    result.ok ? 'OK' : 'FAIL',
    result.statusCode === null ? '-' : String(result.statusCode),
    result.errorMessage ? previewText(result.errorMessage, 60) : '-',
    result.textPreview || '-',
  ])

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index].length))
  )

  const headerLine = headers
    .map((header, index) => pad(header, widths[index]))
    .join(' | ')
  const separatorLine = widths.map((width) => '-'.repeat(width)).join('-|-')

  console.log(headerLine)
  console.log(separatorLine)
  for (const row of rows) {
    console.log(
      row.map((value, index) => pad(value, widths[index])).join(' | ')
    )
  }
}

function buildRecommendations(results: ProbeResult[]): string[] {
  const recommendations: string[] = []
  const modelIds = new Set(results.map((result) => result.modelId))

  for (const modelId of modelIds) {
    const primaryResponses = results.find(
      (result) =>
        result.modelId === modelId &&
        result.kind === 'primary' &&
        result.mode === 'responses'
    )
    if (!primaryResponses || primaryResponses.ok) {
      continue
    }

    const previewFallback = results.find(
      (result) =>
        result.modelId === modelId &&
        result.kind === 'preview-fallback' &&
        result.mode === 'responses'
    )
    if (previewFallback?.ok) {
      recommendations.push(
        `[${modelId}] responses is reachable with api-version=preview but failed with ${primaryResponses.apiVersion}; version mismatch likely.`
      )
    }

    const chatResult = results.find(
      (result) =>
        result.modelId === modelId &&
        result.mode === 'chat' &&
        result.ok &&
        (result.kind === 'secondary-chat' || result.kind === 'primary')
    )
    if (chatResult?.ok) {
      recommendations.push(
        `[${modelId}] chat/completions works while primary responses probe fails.`
      )
    }

    if (
      !previewFallback?.ok &&
      primaryResponses.apiVersionNotSupported &&
      primaryResponses.apiVersion !== PREVIEW_API_VERSION
    ) {
      recommendations.push(
        `[${modelId}] Azure reported "API version not supported"; test with --probe-preview-on-fail or --api-version preview.`
      )
    }

    if (
      primaryResponses.statusCode === 401 ||
      primaryResponses.statusCode === 403
    ) {
      recommendations.push(
        `[${modelId}] authorization failure. Verify AZURE_API_KEY / AZURE_OPENAI_API_KEY and deployment access.`
      )
    }
  }

  return recommendations
}

function toJsonOutput(results: ProbeResult[]) {
  return results.map((result) => ({
    modelId: result.modelId,
    deploymentId: result.deploymentId,
    mode: result.mode,
    apiVersion: result.apiVersion,
    ok: result.ok,
    statusCode: result.statusCode,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    textPreview: result.textPreview,
  }))
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  const apiKey = process.env.AZURE_API_KEY || process.env.AZURE_OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing AZURE_API_KEY / AZURE_OPENAI_API_KEY')
  }

  const baseUrl = resolveBaseUrl(options.baseUrlArg)
  const registry = loadModelRegistry()
  const targets = resolveTargets(options, registry)
  const results: ProbeResult[] = []

  for (const target of targets) {
    const primaryRequest: ProbeRequest = {
      target,
      baseUrl,
      apiKey,
      prompt: options.prompt,
      stream: options.stream,
      verbose: options.verbose,
      required: true,
      kind: 'primary',
    }

    const primaryResult =
      options.mode === 'responses'
        ? await probeResponses(primaryRequest)
        : await probeChat(primaryRequest)
    results.push(primaryResult)

    if (
      options.mode === 'responses' &&
      options.probePreviewOnFail &&
      !primaryResult.ok &&
      target.apiVersion !== PREVIEW_API_VERSION
    ) {
      results.push(
        await probeResponses({
          ...primaryRequest,
          required: false,
          kind: 'preview-fallback',
          target: {
            ...target,
            apiVersion: PREVIEW_API_VERSION,
          },
        })
      )
    }

    if (options.alsoChat && options.mode === 'responses') {
      results.push(
        await probeChat({
          ...primaryRequest,
          required: true,
          kind: 'secondary-chat',
        })
      )
    }
  }

  if (options.json) {
    console.log(JSON.stringify(toJsonOutput(results), null, 2))
  } else {
    console.log(`Base URL: ${baseUrl}`)
    console.log(
      `Targets: ${targets.map((target) => `${target.modelId}@${target.apiVersion}`).join(', ')}`
    )
    printTable(results)

    const recommendations = buildRecommendations(results)
    if (recommendations.length > 0) {
      console.log('\nRecommendations:')
      for (const recommendation of recommendations) {
        console.log(`- ${recommendation}`)
      }
    }
  }

  const hasRequiredFailure = results.some(
    (result) => result.required && !result.ok
  )
  if (hasRequiredFailure) {
    process.exit(1)
  }
}

run().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
