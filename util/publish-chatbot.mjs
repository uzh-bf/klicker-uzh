import { readFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'

// Run from any directory; use the manifest produced by the GraphQL build.
const manifestUrl = new URL(
  '../packages/graphql/src/public/server.json',
  import.meta.url
)

class OperatorError extends Error {}

async function main() {
  const { values } = parseArgs({
    options: {
      'chatbot-id': { type: 'string' },
      apply: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  })
  if (values.help) {
    console.log(
      'Usage: node util/publish-chatbot.mjs --chatbot-id <id> [--apply]\n' +
        'Set KLICKER_API_URL to the GraphQL endpoint and KLICKER_ADMIN_TOKEN to an admin JWT.\n' +
        'Without --apply, only the intended action is printed; no request is sent.'
    )
    return
  }
  const id = values['chatbot-id']?.trim()
  if (!id) throw new OperatorError('--chatbot-id is required')
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: standalone operator CLI, never run through Turbo
  const endpoint = new URL(process.env.KLICKER_API_URL ?? '')
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.protocol !== 'https:' &&
      !(endpoint.protocol === 'http:' && endpoint.hostname === 'localhost'))
  ) {
    throw new OperatorError(
      'Use an HTTPS GraphQL endpoint (HTTP localhost is allowed)'
    )
  }
  console.log(`Publish chatbot ${id} at ${endpoint.href}`)
  if (!values.apply) {
    console.log(
      'Dry run: no request sent. Use --apply after completing review.'
    )
    return
  }
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: standalone operator credential, never passed to Turbo
  const token = process.env.KLICKER_ADMIN_TOKEN
  if (!token?.trim()) throw new OperatorError('KLICKER_ADMIN_TOKEN is required')
  let manifest
  try {
    manifest = JSON.parse(await readFile(manifestUrl, 'utf8'))
  } catch {
    throw new OperatorError(
      'Build @klicker-uzh/graphql first to generate server.json'
    )
  }
  const operation = Object.entries(manifest).find(([, query]) =>
    /\bmutation\s+ApproveChatbotPublication\s*\(/.test(query)
  )
  if (!operation) {
    throw new OperatorError(
      'Rebuild @klicker-uzh/graphql: approval operation is missing'
    )
  }
  // Never forward the admin token to a redirected endpoint or retry a mutation.
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: {
      'content-type': 'application/json',
      'x-graphql-yoga-csrf': '1',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      operationName: 'ApproveChatbotPublication',
      variables: { id },
      extensions: { persistedQuery: { version: 1, sha256Hash: operation[0] } },
    }),
  })
  if (!response.ok)
    throw new OperatorError(`Approval failed: HTTP ${response.status}`)
  const result = await response.json()
  if (result.errors?.length) {
    // Do not print arbitrary server payloads, which can contain sensitive data.
    throw new OperatorError(
      'Approval returned GraphQL errors; inspect backend logs'
    )
  }
  const chatbot = result.data?.approveChatbotPublication
  if (chatbot?.id !== id || chatbot.status !== 'PUBLISHED') {
    throw new OperatorError(
      'Approval did not return the requested published chatbot'
    )
  }
  console.log(`Published chatbot ${chatbot.id}`)
}

try {
  await main()
} catch (error) {
  // Network errors can include request details; keep credentials out of logs.
  if (error instanceof OperatorError) console.error(error.message)
  console.error(
    'Publication failed. Check the arguments, admin token, generated manifest, ' +
      'backend deployment and pending-review status. If a request was sent, ' +
      'verify the chatbot status before trying again.'
  )
  process.exitCode = 1
}
