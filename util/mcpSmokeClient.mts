export const MCP_PROTOCOL_VERSION = '2025-06-18'

type JsonRpcMessage = {
  error?: { code?: number; message?: string }
  id?: number | string
  jsonrpc: '2.0'
  result?: unknown
}

type JsonRpcRequest = {
  id?: number
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export class SmokeReport {
  private failures = 0
  private passes = 0
  private skips = 0

  async check(name: string, run: () => Promise<string> | string) {
    try {
      const detail = await run()
      this.passes += 1
      console.log(`[PASS] ${name}${detail ? ` - ${detail}` : ''}`)
    } catch (error) {
      this.failures += 1
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[FAIL] ${name} - ${message}`)
    }
  }

  skip(name: string, reason: string) {
    this.skips += 1
    console.log(`[SKIP] ${name} - ${reason}`)
  }

  finish() {
    console.log(
      `Summary: ${this.passes} passed, ${this.failures} failed, ${this.skips} skipped`
    )
    return this.failures === 0 ? 0 : 1
  }
}

export function assertSmoke(
  condition: unknown,
  message: string
): asserts condition {
  if (!condition) throw new Error(message)
}

export function envFlag(name: string) {
  return ['1', 'true', 'yes'].includes(
    String(process.env[name] ?? '').toLowerCase()
  )
}

export function envSource(name: string, defaultLabel: string) {
  return process.env[name] ? 'custom' : defaultLabel
}

export function mcpHealthUrl(url: string) {
  const parsed = new URL(url)
  const basePath = parsed.pathname.replace(/\/mcp\/?$/, '').replace(/\/$/, '')
  parsed.pathname = `${basePath}/healthz`
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}

export async function checkMcpHealth(url: string) {
  const healthUrl = mcpHealthUrl(url)
  const response = await fetch(healthUrl)
  assertSmoke(response.ok, `GET ${healthUrl} returned HTTP ${response.status}`)
  return `HTTP ${response.status}`
}

function parseSseMessages(text: string): JsonRpcMessage[] {
  const messages: JsonRpcMessage[] = []
  let dataLines: string[] = []

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart())
      continue
    }

    if (line.trim() === '' && dataLines.length > 0) {
      messages.push(JSON.parse(dataLines.join('\n')) as JsonRpcMessage)
      dataLines = []
    }
  }

  if (dataLines.length > 0) {
    messages.push(JSON.parse(dataLines.join('\n')) as JsonRpcMessage)
  }

  return messages
}

function parseRpcMessages(text: string, contentType: string | null) {
  if (!text.trim()) return []
  if (contentType?.includes('text/event-stream')) {
    return parseSseMessages(text)
  }
  const parsed = JSON.parse(text) as JsonRpcMessage | JsonRpcMessage[]
  return Array.isArray(parsed) ? parsed : [parsed]
}

function asRecord(value: unknown) {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

export function parseJsonToolResult<T = unknown>(result: unknown): T {
  const record = asRecord(result)
  if (!record) return result as T

  if (record.structuredContent) {
    return record.structuredContent as T
  }

  if (Array.isArray(record.content)) {
    const text = record.content
      .map(asRecord)
      .find(
        (part) => part?.type === 'text' && typeof part.text === 'string'
      )?.text

    if (typeof text === 'string') {
      const parsed = JSON.parse(text) as unknown
      const parsedRecord = asRecord(parsed)
      if (parsedRecord?.error) {
        throw new Error(
          `tool returned error ${JSON.stringify(parsedRecord.error)}`
        )
      }
      return parsed as T
    }
  }

  if (record.error) {
    throw new Error(`tool returned error ${JSON.stringify(record.error)}`)
  }

  return result as T
}

export class RawMcpClient {
  private nextId = 1
  private protocolVersion: string | undefined
  private sessionId: string | undefined

  constructor(
    private readonly options: {
      token: string
      url: string
    }
  ) {}

  private headers() {
    const headers: Record<string, string> = {
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${this.options.token}`,
      'Content-Type': 'application/json',
    }

    if (this.sessionId) headers['mcp-session-id'] = this.sessionId
    if (this.protocolVersion) {
      headers['mcp-protocol-version'] = this.protocolVersion
    }

    return headers
  }

  private async post(message: JsonRpcRequest): Promise<unknown> {
    const response = await fetch(this.options.url, {
      body: JSON.stringify(message),
      headers: this.headers(),
      method: 'POST',
    })

    const sessionId = response.headers.get('mcp-session-id')
    if (sessionId) this.sessionId = sessionId

    const text = await response.text()
    if (!response.ok) {
      throw new Error(
        `POST ${message.method} returned HTTP ${response.status}: ${text}`
      )
    }
    if (message.id == null) return undefined
    if (response.status === 202) return undefined

    const messages = parseRpcMessages(
      text,
      response.headers.get('content-type')
    )
    const rpc = messages.find((candidate) => candidate.id === message.id)
    assertSmoke(rpc, `no JSON-RPC response for ${message.method}`)
    if (rpc.error) {
      throw new Error(
        `JSON-RPC ${message.method} error ${rpc.error.code}: ${rpc.error.message}`
      )
    }
    return rpc.result
  }

  async initialize() {
    const result = await this.post({
      id: this.nextId++,
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        capabilities: {},
        clientInfo: {
          name: 'klicker-mcp-smoke',
          version: '0.1.0',
        },
        protocolVersion: MCP_PROTOCOL_VERSION,
      },
    })

    const record = asRecord(result)
    const protocolVersion = record?.protocolVersion
    assertSmoke(
      typeof protocolVersion === 'string',
      'initialize result did not include protocolVersion'
    )
    this.protocolVersion = protocolVersion

    await this.post({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    })

    return result
  }

  async listTools() {
    const result = await this.post({
      id: this.nextId++,
      jsonrpc: '2.0',
      method: 'tools/list',
      params: {},
    })
    const tools = asRecord(result)?.tools
    assertSmoke(Array.isArray(tools), 'tools/list result did not include tools')
    return tools as Array<{ name?: string }>
  }

  async callTool<T = unknown>(name: string, args: Record<string, unknown>) {
    const result = await this.post({
      id: this.nextId++,
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        arguments: args,
        name,
      },
    })
    return parseJsonToolResult<T>(result)
  }
}

export function assertTools(
  tools: Array<{ name?: string }>,
  expectedTools: string[]
) {
  const names = new Set(tools.map((tool) => tool.name))
  const missing = expectedTools.filter((tool) => !names.has(tool))
  assertSmoke(missing.length === 0, `missing tools: ${missing.join(', ')}`)
  return `${tools.length} tools`
}
