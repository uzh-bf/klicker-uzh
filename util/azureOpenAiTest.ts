type Mode = 'chat' | 'responses'

type CliOptions = {
  mode: Mode
  baseUrl: string
  deployment: string
  apiVersion: string
  prompt: string
  stream: boolean
  verbose: boolean
}

const DEFAULT_BASE_URL = 'https://klicker-ai.cognitiveservices.azure.com/openai'

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'chat',
    baseUrl: DEFAULT_BASE_URL,
    deployment: 'gpt-5.1',
    apiVersion: '',
    prompt: 'This is a test.',
    stream: true,
    verbose: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--mode': {
        const value = argv[i + 1]
        if (value === 'chat' || value === 'responses') {
          options.mode = value
          i += 1
        }
        break
      }
      case '--base-url': {
        const value = argv[i + 1]
        if (value) {
          options.baseUrl = value
          i += 1
        }
        break
      }
      case '--deployment': {
        const value = argv[i + 1]
        if (value) {
          options.deployment = value
          i += 1
        }
        break
      }
      case '--api-version': {
        const value = argv[i + 1]
        if (value) {
          options.apiVersion = value
          i += 1
        }
        break
      }
      case '--prompt': {
        const value = argv[i + 1]
        if (value) {
          options.prompt = value
          i += 1
        }
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
      default:
        break
    }
  }

  return options
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

async function readResponseBody(response: Response) {
  try {
    const json = await response.json()
    return JSON.stringify(json)
  } catch {
    try {
      return await response.text()
    } catch {
      return ''
    }
  }
}

async function streamChatCompletions(
  response: Response,
  verbose: boolean
): Promise<{ text: string; finishReason?: string }> {
  const reader = response.body?.getReader()
  if (!reader) {
    return { text: '' }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let finishReason: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      if (line.startsWith('data: ')) {
        const payload = line.slice(6)
        if (payload === '[DONE]') {
          return { text, finishReason }
        }

        const data = JSON.parse(payload)
        if (verbose) {
          console.log('[event]', data)
        }

        const delta = data?.choices?.[0]?.delta?.content
        if (delta) {
          text += delta
        }

        const reason = data?.choices?.[0]?.finish_reason
        if (reason) {
          finishReason = reason
        }
      }
    }
  }

  return { text, finishReason }
}

async function streamResponses(
  response: Response,
  verbose: boolean
): Promise<{ text: string; status?: string }> {
  const reader = response.body?.getReader()
  if (!reader) {
    return { text: '' }
  }

  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let status: string | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.trim()) continue
      if (!line.startsWith('data: ')) continue

      const payload = line.slice(6)
      if (payload === '[DONE]') {
        return { text, status }
      }

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

      if (data?.type === 'response.completed') {
        status = data.response?.status || data.response?.status_text
        if (!text && typeof data.response?.output_text === 'string') {
          text = data.response.output_text
        }
      }
    }
  }

  return { text, status }
}

async function run() {
  const options = parseArgs(process.argv.slice(2))
  if (!options.apiVersion) {
    console.error('Missing --api-version')
    process.exit(1)
  }

  const apiKey = process.env.AZURE_API_KEY || process.env.AZURE_OPENAI_API_KEY
  if (!apiKey) {
    console.error('Missing AZURE_API_KEY / AZURE_OPENAI_API_KEY')
    process.exit(1)
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const apiVersion = encodeURIComponent(options.apiVersion)

  const url =
    options.mode === 'chat'
      ? `${baseUrl}/deployments/${encodeURIComponent(
          options.deployment
        )}/chat/completions?api-version=${apiVersion}`
      : `${baseUrl}/v1/responses?api-version=${apiVersion}`

  const body =
    options.mode === 'chat'
      ? {
          messages: [{ role: 'user', content: options.prompt }],
          stream: options.stream,
        }
      : {
          model: options.deployment,
          input: options.prompt,
          stream: options.stream,
        }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const responseBody = await readResponseBody(response)
    console.error('Request failed')
    console.error('Status:', response.status)
    console.error('Body:', responseBody)
    process.exit(1)
  }

  if (!options.stream) {
    const json = await response.json()
    if (options.mode === 'chat') {
      const text = json?.choices?.[0]?.message?.content || ''
      const finishReason = json?.choices?.[0]?.finish_reason
      console.log(text)
      if (finishReason) {
        console.log('\n[finish_reason]', finishReason)
      }
      return
    }

    const text = json?.output_text || ''
    console.log(text)
    if (json?.status) {
      console.log('\n[status]', json.status)
    }
    return
  }

  if (options.mode === 'chat') {
    const result = await streamChatCompletions(response, options.verbose)
    console.log(result.text)
    if (result.finishReason) {
      console.log('\n[finish_reason]', result.finishReason)
    }
    return
  }

  const result = await streamResponses(response, options.verbose)
  console.log(result.text)
  if (result.status) {
    console.log('\n[status]', result.status)
  }
}

run().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
