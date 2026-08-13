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

export type PromptCacheIdentityInput = {
  deploymentId: string
  transport: PromptCacheTransport
  instructions: string
  tools: ToolSet
}

export type PromptCacheProviderOptionsInput = {
  promptCacheKey: string
  routingSource: 'custom' | 'default'
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
  for (const key of Object.keys(value).sort()) {
    const canonicalValue = canonicalizeJson(value[key])
    if (canonicalValue !== undefined) {
      result[key] = canonicalValue
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
  description: string | undefined
): JsonObject {
  const providerTool: JsonObject = {
    type: 'function',
    name,
    inputSchema: inputSchema ?? {},
  }

  if (description !== undefined) providerTool.description = description

  for (const key of ['inputExamples', 'providerOptions', 'strict'] as const) {
    const value = canonicalizeJson(tool[key])
    if (value !== undefined) providerTool[key] = value
  }

  return providerTool
}

async function canonicalizeTool(
  name: string,
  rawTool: unknown
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
      description
    ),
    tool: canonicalTool,
  }
}

export async function buildPromptCacheRequest(
  input: PromptCacheIdentityInput
): Promise<PromptCacheRequest> {
  const entries = Object.entries(input.tools).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0
  )
  const canonicalEntries = await Promise.all(
    entries.map(async ([name, tool]) => {
      const canonicalTool = await canonicalizeTool(name, tool)
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

export function getOpenAIPromptCacheOptions({
  promptCacheKey,
  routingSource,
}: PromptCacheProviderOptionsInput): { promptCacheKey?: string } {
  if (routingSource !== 'default') return {}

  return { promptCacheKey }
}
