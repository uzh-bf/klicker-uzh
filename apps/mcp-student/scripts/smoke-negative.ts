import { randomUUID } from 'node:crypto'
import {
  RawMcpClient,
  SmokeReport,
  assertSmoke,
  checkMcpHealth,
  envSource,
} from '../../../util/mcpSmokeClient.mjs'

const DEFAULT_URL = 'http://localhost:7080/mcp'
const DEFAULT_PARTICIPANT_ID = '6f45065c-667f-4259-818c-c6f6b477eb48'
const DEFAULT_COURSE_ID = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
const DEFAULT_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const DEFAULT_SCOPE = 'student:practice:read student:practice:submit'
const READ_ONLY_SCOPE = 'student:practice:read'
const JWT_MODULE = '@klicker-uzh/util'

// Basic leak check: a safe student-facing error message should never carry a
// stack trace frame, a node_modules path, or the raw connection string
// (matched by URL shape, since a leaked backend error embeds the value,
// not the env-var name).
const LEAK_PATTERNS: RegExp[] = [
  /\bat \//,
  /node_modules/,
  /DATABASE_URL/,
  /postgres(ql)?:\/\/\S+/,
]

type SignJwt = (
  payload: Record<string, unknown>,
  secret: string,
  options: {
    algorithm: 'HS256'
    expiresIn: string | number
    issuer: string
  }
) => Promise<string>

type MintTokenOverrides = {
  actor?: string
  expiresIn?: string | number
  issuer?: string
  // Claims to leave out entirely, so a token can be shaped like an ordinary
  // participant session token rather than an MCP token.
  omitClaims?: string[]
  purpose?: string
  role?: string
  scope?: string
  secret?: string
  sub?: string
}

type PracticeLookup = {
  candidates?: Array<{ questionRef?: string }>
}

function help() {
  console.log(`Student MCP negative-path smoke

Prerequisites:
  - backend GraphQL is running and seeded
  - apps/mcp-student is running on the configured URL
  - APP_SECRET or MCP_STUDENT_JWT_SECRET and APP_ORIGIN_AUTH match the running services

Usage:
  pnpm --filter @klicker-uzh/mcp-student smoke:negative

Environment:
  MCP_STUDENT_SMOKE_URL             default ${DEFAULT_URL}
  MCP_STUDENT_SMOKE_PARTICIPANT_ID  default seeded testuser1
  MCP_STUDENT_SMOKE_COURSE_ID       default seeded Testkurs
  MCP_STUDENT_SMOKE_CHATBOT_ID      default seeded Benibot
  APP_SECRET                        default abcd
  MCP_STUDENT_JWT_SECRET            default APP_SECRET
  APP_ORIGIN_AUTH                   default http://localhost:3010

Options:
  --dry-run                         print resolved config without network calls
  --help                            show this help
`)
}

function assertNoLeak(message: string) {
  for (const pattern of LEAK_PATTERNS) {
    assertSmoke(
      !pattern.test(message),
      `error message leaked internal details (${pattern}): ${message}`
    )
  }
}

// Negative cases are expected to reject. Run the action, require that it
// rejected, and hand back the caught message for shape/leak assertions.
async function expectRejection(
  action: () => Promise<unknown>
): Promise<string> {
  let succeeded = false
  let capturedMessage = ''

  try {
    await action()
    succeeded = true
  } catch (error) {
    capturedMessage = error instanceof Error ? error.message : String(error)
  }

  assertSmoke(!succeeded, 'expected the call to be rejected, but it succeeded')
  return capturedMessage
}

async function main() {
  if (process.argv.includes('--help')) {
    help()
    return 0
  }

  const url = process.env.MCP_STUDENT_SMOKE_URL ?? DEFAULT_URL
  const participantId =
    process.env.MCP_STUDENT_SMOKE_PARTICIPANT_ID ?? DEFAULT_PARTICIPANT_ID
  const courseId = process.env.MCP_STUDENT_SMOKE_COURSE_ID ?? DEFAULT_COURSE_ID
  const chatbotId =
    process.env.MCP_STUDENT_SMOKE_CHATBOT_ID ?? DEFAULT_CHATBOT_ID
  const issuer = process.env.APP_ORIGIN_AUTH ?? 'http://localhost:3010'
  const secret =
    process.env.MCP_STUDENT_JWT_SECRET ?? process.env.APP_SECRET ?? 'abcd'

  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify(
        {
          participantId: envSource(
            'MCP_STUDENT_SMOKE_PARTICIPANT_ID',
            'default seeded participant'
          ),
          url: envSource('MCP_STUDENT_SMOKE_URL', DEFAULT_URL),
        },
        null,
        2
      )
    )
    return 0
  }

  const report = new SmokeReport()
  const capturedMessages: string[] = []
  const { signJWT } = (await import(JWT_MODULE)) as { signJWT: SignJwt }

  function mintToken(overrides: MintTokenOverrides = {}): Promise<string> {
    const payload: Record<string, unknown> = {
      actor: overrides.actor ?? 'account',
      purpose: overrides.purpose ?? 'student-mcp',
      role: overrides.role ?? 'PARTICIPANT',
      scope: overrides.scope ?? DEFAULT_SCOPE,
      sub: overrides.sub ?? participantId,
    }

    for (const claim of overrides.omitClaims ?? []) {
      delete payload[claim]
    }

    return signJWT(payload, overrides.secret ?? secret, {
      algorithm: 'HS256',
      expiresIn: overrides.expiresIn ?? '1h',
      issuer: overrides.issuer ?? issuer,
    })
  }

  // FastMCP authenticates once, at `initialize`, and caches the session for
  // the lifetime of the mcp-session-id; tools/call never re-checks the
  // bearer token. So every unauthenticated/invalid token case below is
  // expected to fail at `initialize`, surfaced by mcp-proxy as an HTTP 401
  // with a JSON-RPC error body.
  async function expectAuthRejectionAtInitialize(name: string, token: string) {
    await report.check(name, async () => {
      const client = new RawMcpClient({ token, url })
      const message = await expectRejection(() => client.initialize())
      capturedMessages.push(message)
      assertNoLeak(message)
      assertSmoke(
        /HTTP 401/.test(message),
        `expected HTTP 401 auth rejection, got: ${message}`
      )
      return 'initialize rejected with HTTP 401'
    })
  }

  await report.check('health', () => checkMcpHealth(url))

  // 1. Empty bearer token.
  await expectAuthRejectionAtInitialize('empty bearer token rejected', '')

  // 2. Garbage bearer token: not a JWT at all.
  await expectAuthRejectionAtInitialize(
    'garbage bearer token rejected',
    'not-a-real-jwt-token'
  )

  // 3. Token signed with the wrong secret.
  await expectAuthRejectionAtInitialize(
    'wrong secret rejected',
    await mintToken({ secret: 'a-completely-different-secret' })
  )

  // 4. Token signed with the wrong issuer.
  await expectAuthRejectionAtInitialize(
    'wrong issuer rejected',
    // https, not http: the assertion is that the issuer does not MATCH the
    // expected one, so the scheme is irrelevant here — and an http literal
    // trips SonarCloud's S5332 (insecure protocol) on a non-localhost host.
    await mintToken({ issuer: 'https://wrong-issuer.invalid' })
  )

  // 5. An ordinary participant session token: same subject, same role, same
  // signing secret, and no MCP claims at all. This is the case the purpose
  // claim exists for — a stolen session cookie must not open an MCP session.
  await expectAuthRejectionAtInitialize(
    'participant session token rejected',
    await mintToken({ omitClaims: ['actor', 'purpose', 'scope'] })
  )

  // 6. A lecturer MCP token presented to the student service.
  await expectAuthRejectionAtInitialize(
    'lecturer MCP token rejected',
    await mintToken({
      omitClaims: ['actor'],
      purpose: 'lecturer-mcp',
      role: 'USER',
      scope: 'manage:read manage:draft',
    })
  )

  // 7. Token with a non-participant role.
  await expectAuthRejectionAtInitialize(
    'wrong role rejected',
    await mintToken({ role: 'USER' })
  )

  // 8. Token without a known actor kind.
  await expectAuthRejectionAtInitialize(
    'unknown actor kind rejected',
    await mintToken({ actor: 'root' })
  )

  // 9. Token carrying no student scope at all.
  await expectAuthRejectionAtInitialize(
    'token without a student scope rejected',
    await mintToken({ scope: 'manage:read' })
  )

  // 10. Expired token. verifyJWT allows a small clock tolerance, so back-date
  // the expiry well beyond it instead of sleeping past it.
  await expectAuthRejectionAtInitialize(
    'expired token rejected',
    await mintToken({ expiresIn: '-30s' })
  )

  // 11. Read-only scope: the lookup tool is advertised, the submit tool is
  // not. fastmcp registers a tool for a session only when the session's
  // scopes satisfy the policy's `rbacScope`, so a read-only session has no
  // dispatch entry for submitting at all.
  await report.check('read-only scope hides the submit tool', async () => {
    const token = await mintToken({ scope: READ_ONLY_SCOPE })
    const client = new RawMcpClient({ token, url })
    await client.initialize()
    const names = (await client.listTools()).map((tool) => tool.name)
    assertSmoke(
      names.includes('lookup_relevant_practice_stacks'),
      `expected the lookup tool to be advertised, got: ${names.join(', ')}`
    )
    assertSmoke(
      !names.includes('submit_practice_stack_answer'),
      'submit tool must not be advertised to a read-only session'
    )
    return `${names.length} tools advertised`
  })

  await report.check(
    'read-only scope cannot call the submit tool',
    async () => {
      const token = await mintToken({ scope: READ_ONLY_SCOPE })
      const client = new RawMcpClient({ token, url })
      await client.initialize()
      const message = await expectRejection(() =>
        client.callTool('submit_practice_stack_answer', {
          questionRef: 'irrelevant-the-tool-is-not-reachable',
          responses: [{ instanceId: 1, type: 'FLASHCARD' }],
          stackAnswerTimeSeconds: 1,
        })
      )
      capturedMessages.push(message)
      assertNoLeak(message)
      assertSmoke(
        /unknown tool/i.test(message),
        `expected an unknown-tool rejection, got: ${message}`
      )
      return 'submit tool unknown to a read-only session'
    }
  )

  // 12. Valid token, forged question reference: references are HMAC-signed by
  // the service, so an attacker-supplied one must not resolve to a stack.
  await report.check('forged question reference rejected', async () => {
    const token = await mintToken()
    const client = new RawMcpClient({ token, url })
    await client.initialize()
    const message = await expectRejection(() =>
      client.callTool('get_practice_stack_for_quiz', {
        questionRef: 'forged.question.ref',
      })
    )
    capturedMessages.push(message)
    assertNoLeak(message)
    return 'question reference rejected'
  })

  // 13. Valid token for a participant with no enrolment: the course's
  // practice pool must not leak. Either outcome is acceptable — the backend
  // refuses the forwarded token, or the lookup returns no candidates — as
  // long as no stack references come back.
  await report.check('unenrolled participant gets no candidates', async () => {
    const token = await mintToken({ sub: randomUUID() })
    const client = new RawMcpClient({ token, url })
    await client.initialize()

    let candidateCount: number | null = null
    let message = ''

    try {
      const result = await client.callTool<PracticeLookup>(
        'lookup_relevant_practice_stacks',
        {
          chatbotId,
          courseId,
          lastUserMessage: 'What should I practice?',
        }
      )
      candidateCount = result.candidates?.length ?? 0
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
      capturedMessages.push(message)
      assertNoLeak(message)
    }

    assertSmoke(
      candidateCount === null || candidateCount === 0,
      `expected no candidates for an unenrolled participant, got ${candidateCount}`
    )
    return candidateCount === null
      ? 'lookup rejected for an unenrolled participant'
      : '0 candidates'
  })

  // 14. None of the captured negative-path error messages above leaked a
  // stack trace, an internal path, or the database connection string.
  await report.check('no leaked internal details across all cases', () => {
    for (const message of capturedMessages) {
      assertNoLeak(message)
    }
    return `${capturedMessages.length} error messages checked`
  })

  return report.finish()
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
