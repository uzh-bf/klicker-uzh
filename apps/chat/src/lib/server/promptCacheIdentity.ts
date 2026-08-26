import { createHash } from 'node:crypto'
import {
  asSchema,
  type FlexibleSchema,
  type JSONSchema7,
  jsonSchema,
  type ToolSet,
} from 'ai'

const PROMPT_CACHE_KEY_VERSION = 'klicker:pc:v1'
const PROMPT_CACHE_KEY_MAX_LENGTH = 64
const PROMPT_CACHE_KEY_DIGEST_LENGTH =
  PROMPT_CACHE_KEY_MAX_LENGTH - PROMPT_CACHE_KEY_VERSION.length - 1

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type JsonObject = { [key: string]: JsonValue }
type UnknownObject = Record<string, unknown>

type PromptCacheTransport = 'chat' | 'responses'

const OPENAI_RESPONSES_TOOL_OPTION_KEYS = [
  'allowedCallers',
  'deferLoading',
  'namespace',
  'outputSchema',
] as const

function compareStrings(left: string, right: string) {
  return left.localeCompare(right, 'en-US')
}

export type PromptCacheIdentityInput = {
  deploymentId: string
  transport: PromptCacheTransport
  instructions: string
  tools: ToolSet
  toolOrder?: readonly string[]
}

export type PromptCacheRequest = {
  promptCacheKey: string
  toolOrder: string[]
  tools: ToolSet
}

function isObject(value: unknown): value is UnknownObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalizeJson(value: unknown): JsonValue | undefined {
  if (value === undefined || typeof value === 'function') return undefined
  if (value === null) return null
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item) ?? null)
  }

  if (!isObject(value)) return undefined

  const result: JsonObject = {}
  for (const key of Object.keys(value).sort(compareStrings)) {
    const canonicalValue = canonicalizeJson(value[key])
    if (canonicalValue !== undefined) {
      Object.defineProperty(result, key, {
        value: canonicalValue,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
  }
  return result
}

function getDescription(tool: UnknownObject): string | undefined {
  const description = tool.description
  if (typeof description === 'string') return description
  if (typeof description !== 'function') return undefined

  const resolved = description({ context: undefined })
  return typeof resolved === 'string' ? resolved : undefined
}

function getProviderFunctionTool(
  name: string,
  tool: UnknownObject,
  inputSchema: JsonValue | undefined,
  description: string | undefined,
  transport: PromptCacheTransport
): JsonObject {
  const providerTool: JsonObject = {
    type: 'function',
    name,
    inputSchema: inputSchema ?? {},
  }

  if (description !== undefined) providerTool.description = description

  const strict = canonicalizeJson(tool.strict)
  if (strict !== undefined) providerTool.strict = strict

  const providerOptions = tool.providerOptions
  const openAIOptions =
    isObject(providerOptions) && isObject(providerOptions.openai)
      ? providerOptions.openai
      : undefined
  if (transport === 'responses' && openAIOptions) {
    const responsesOptions: JsonObject = {}
    for (const key of OPENAI_RESPONSES_TOOL_OPTION_KEYS) {
      const value = canonicalizeJson(openAIOptions[key])
      if (value !== undefined) responsesOptions[key] = value
    }
    if (Object.keys(responsesOptions).length > 0) {
      providerTool.responsesOptions = responsesOptions
    }
  }

  return providerTool
}

async function canonicalizeTool(
  name: string,
  rawTool: unknown,
  transport: PromptCacheTransport
): Promise<{ providerTool: JsonObject; tool: unknown }> {
  if (!isObject(rawTool)) {
    throw new Error(`Invalid tool definition for ${name}`)
  }

  if (rawTool.type === 'provider') {
    const providerTool: JsonObject = {
      type: 'provider',
      name,
      id: canonicalizeJson(rawTool.id) ?? null,
      args: canonicalizeJson(rawTool.args) ?? null,
    }
    return {
      providerTool,
      tool: rawTool,
    }
  }

  const inputSchema = rawTool.inputSchema
  if (inputSchema === undefined) {
    throw new Error(`Tool ${name} has no input schema`)
  }

  const schema = asSchema(inputSchema as FlexibleSchema<unknown>)
  const schemaJson = canonicalizeJson(await schema.jsonSchema)
  const canonicalSchema = jsonSchema(
    (schemaJson ?? {}) as JSONSchema7,
    schema.validate ? { validate: schema.validate } : undefined
  )
  const description = getDescription(rawTool)
  const canonicalTool = {
    ...rawTool,
    inputSchema: canonicalSchema,
    ...(description === undefined ? {} : { description }),
    ...(rawTool.inputExamples === undefined
      ? {}
      : { inputExamples: canonicalizeJson(rawTool.inputExamples) }),
    ...(rawTool.providerOptions === undefined
      ? {}
      : { providerOptions: canonicalizeJson(rawTool.providerOptions) }),
  }

  return {
    providerTool: getProviderFunctionTool(
      name,
      rawTool,
      schemaJson,
      description,
      transport
    ),
    tool: canonicalTool,
  }
}

export async function buildPromptCacheRequest(
  input: PromptCacheIdentityInput
): Promise<PromptCacheRequest> {
  const configuredOrder = new Map(
    (input.toolOrder ?? []).map((name, index) => [name, index])
  )
  const entries = Object.entries(input.tools).sort(([left], [right]) => {
    const leftIndex = configuredOrder.get(left)
    const rightIndex = configuredOrder.get(right)
    if (leftIndex !== undefined || rightIndex !== undefined) {
      if (leftIndex === undefined) return 1
      if (rightIndex === undefined) return -1
      return leftIndex - rightIndex
    }
    return compareStrings(left, right)
  })
  const canonicalEntries = await Promise.all(
    entries.map(async ([name, tool]) => {
      const canonicalTool = await canonicalizeTool(name, tool, input.transport)
      return [name, canonicalTool] as const
    })
  )

  const tools = Object.fromEntries(
    canonicalEntries.map(([name, canonicalTool]) => [name, canonicalTool.tool])
  ) as ToolSet
  const providerTools = canonicalEntries.map(
    ([, canonicalTool]) => canonicalTool.providerTool
  )
  const toolOrder = canonicalEntries.map(([name]) => name)
  const fingerprint = canonicalizeJson({
    version: PROMPT_CACHE_KEY_VERSION,
    deploymentId: input.deploymentId,
    transport: input.transport,
    instructions: input.instructions,
    tools: providerTools,
  })
  const digest = createHash('sha256')
    .update(JSON.stringify(fingerprint))
    .digest('hex')

  return {
    promptCacheKey: `${PROMPT_CACHE_KEY_VERSION}:${digest.slice(
      0,
      PROMPT_CACHE_KEY_DIGEST_LENGTH
    )}`,
    toolOrder,
    tools,
  }
}
