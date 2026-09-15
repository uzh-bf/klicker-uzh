import { randomUUID } from 'node:crypto'
import {
  RawMcpClient,
  SmokeReport,
  assertSmoke,
  checkMcpHealth,
  envSource,
} from '../../../util/mcpSmokeClient.mjs'

const DEFAULT_URL = 'http://localhost:7081/mcp'
const DEFAULT_USER_ID = '76047345-3801-4628-ae7b-adbebcfe8821'
const DEFAULT_SCOPE = 'manage:read manage:draft'
const READ_ONLY_SCOPE = 'manage:read'
const JWT_MODULE = '../src/jwt.js'

// Basic leak check: a safe lecturer-facing error message should never carry a
// stack trace frame, a node_modules path, or the raw connection string
// (matched by URL shape, since a leaked Prisma error embeds the value,
// not the env-var name).
const LEAK_PATTERNS: RegExp[] = [
  /\bat \//,
  /node_modules/,
  /DATABASE_URL/,
  /postgres(ql)?:\/\/\S+/,
]

type SignLecturerJwt = (
  payload: Record<string, unknown>,
  secret: string,
  options: {
    expiresIn?: string | number
    issuer?: string
  }
) => Promise<string>

type MintTokenOverrides = {
  expiresIn?: string | number
  issuer?: string
  purpose?: string
  role?: string
  scope?: string
  secret?: string
  sub?: string
}

type CourseList = {
  courses?: Array<{ id?: string; name?: string }>
}

function help() {
  console.log(`Lecturer MCP negative-path smoke

Prerequisites:
  - database is running and seeded
  - apps/mcp-lecturer is running on the configured URL
  - APP_SECRET or MCP_LECTURER_JWT_SECRET and APP_ORIGIN_AUTH match the running service

Usage:
  pnpm --filter @klicker-uzh/mcp-lecturer smoke:negative

Environment:
  MCP_LECTURER_SMOKE_URL       default ${DEFAULT_URL}
  MCP_LECTURER_SMOKE_USER_ID   default seeded lecturer
  APP_SECRET                   default abcd
  MCP_LECTURER_JWT_SECRET      default APP_SECRET
  APP_ORIGIN_AUTH              default http://localhost:3010

Options:
  --dry-run                    print resolved config without network calls
  --help                       show this help
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

  const url = process.env.MCP_LECTURER_SMOKE_URL ?? DEFAULT_URL
  const userId = process.env.MCP_LECTURER_SMOKE_USER_ID ?? DEFAULT_USER_ID
  const issuer = process.env.APP_ORIGIN_AUTH ?? 'http://localhost:3010'
  const secret =
    process.env.MCP_LECTURER_JWT_SECRET ?? process.env.APP_SECRET ?? 'abcd'

  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify(
        {
          url: envSource('MCP_LECTURER_SMOKE_URL', DEFAULT_URL),
          userId: envSource(
            'MCP_LECTURER_SMOKE_USER_ID',
            'default seeded lecturer'
          ),
        },
        null,
        2
      )
    )
    return 0
  }

  const report = new SmokeReport()
  const capturedMessages: string[] = []
  const { signLecturerJwt } = (await import(JWT_MODULE)) as {
    signLecturerJwt: SignLecturerJwt
  }

  function mintToken(overrides: MintTokenOverrides = {}): Promise<string> {
    return signLecturerJwt(
      {
        purpose: overrides.purpose ?? 'lecturer-mcp',
        role: overrides.role ?? 'USER',
        scope: overrides.scope ?? DEFAULT_SCOPE,
        sub: overrides.sub ?? userId,
      },
      overrides.secret ?? secret,
      {
        expiresIn: overrides.expiresIn ?? '1h',
        issuer: overrides.issuer ?? issuer,
      }
    )
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

  // 1. Garbage bearer token: not a JWT at all.
  await expectAuthRejectionAtInitialize(
    'garbage bearer token rejected',
    'not-a-real-jwt-token'
  )

  // 2. Token signed with the wrong secret.
  await expectAuthRejectionAtInitialize(
    'wrong secret rejected',
    await mintToken({ secret: 'a-completely-different-secret' })
  )

  // 3. Token signed with the wrong issuer.
  await expectAuthRejectionAtInitialize(
    'wrong issuer rejected',
    // https, not http: the assertion is that the issuer does not MATCH the
    // expected one, so the scheme is irrelevant here — and an http literal
    // trips SonarCloud's S5332 (insecure protocol) on a non-localhost host.
    await mintToken({ issuer: 'https://wrong-issuer.invalid' })
  )

  // 4. Token with the wrong purpose (e.g. a manage-assistant proposal token
  // presented as a lecturer MCP session token).
  await expectAuthRejectionAtInitialize(
    'wrong purpose rejected',
    await mintToken({ purpose: 'manage-assistant-proposal' })
  )

  // 5. Token with a non-lecturer role.
  await expectAuthRejectionAtInitialize(
    'wrong role rejected',
    await mintToken({ role: 'PARTICIPANT' })
  )

  // 6. Expired token. verifyLecturerJwt uses a 5s clockTolerance, so back-date
  // the expiry well beyond that instead of sleeping past it.
  await expectAuthRejectionAtInitialize(
    'expired token rejected',
    await mintToken({ expiresIn: '-30s' })
  )

  // 7. Token carrying no lecturer scope at all: authentication itself fails,
  // before any per-tool scope check, so the session never exists.
  await expectAuthRejectionAtInitialize(
    'token without a lecturer scope rejected',
    await mintToken({ scope: 'student:practice:read' })
  )

  // 8. Read-only scope: a read tool succeeds, and the draft tools are not
  // even advertised. fastmcp registers a tool for a session only when the
  // session's scopes satisfy the policy's `rbacScope`, so a read-only session
  // has no dispatch entry for drafting at all.
  await report.check('read-only scope allows read tool', async () => {
    const token = await mintToken({ scope: READ_ONLY_SCOPE })
    const client = new RawMcpClient({ token, url })
    await client.initialize()
    const result = await client.callTool<CourseList>(
      'klicker_lecturer_course_list',
      { limit: 5 }
    )
    assertSmoke(Array.isArray(result.courses), 'courses missing')
    return `${result.courses?.length ?? 0} courses`
  })

  await report.check('read-only scope hides the draft tools', async () => {
    const token = await mintToken({ scope: READ_ONLY_SCOPE })
    const client = new RawMcpClient({ token, url })
    await client.initialize()
    const names = (await client.listTools()).map((tool) => tool.name)
    assertSmoke(
      names.includes('klicker_lecturer_course_list'),
      `expected the course list tool to be advertised, got: ${names.join(', ')}`
    )
    const advertisedDraftTools = names.filter(
      (name) => typeof name === 'string' && name.includes('draft')
    )
    assertSmoke(
      advertisedDraftTools.length === 0,
      `draft tools must not be advertised to a read-only session: ${advertisedDraftTools.join(', ')}`
    )
    return `${names.length} tools advertised, no draft tools`
  })

  await report.check(
    'read-only scope cannot call the draft proposal tool',
    async () => {
      const token = await mintToken({ scope: READ_ONLY_SCOPE })
      const client = new RawMcpClient({ token, url })
      await client.initialize()
      const message = await expectRejection(() =>
        client.callTool('klicker_lecturer_element_create_draft_proposal', {
          choices: [
            { correct: true, value: 'Variation or dispersion in the data' },
            { correct: false, value: 'The average value' },
          ],
          content: 'What does standard deviation measure?',
          explanation: 'Standard deviation summarizes dispersion.',
          name: 'Negative smoke standard deviation question',
          tags: ['smoke-negative'],
          type: 'SC',
        })
      )
      capturedMessages.push(message)
      assertNoLeak(message)
      assertSmoke(
        /unknown tool/i.test(message),
        `expected an unknown-tool rejection, got: ${message}`
      )
      return 'draft proposal tool unknown to a read-only session'
    }
  )

  // 9. Valid token, unknown-but-well-formed course UUID: non-enumerating
  // FORBIDDEN-style "not found or not accessible" from service.inaccessible().
  await report.check(
    'unknown course id rejected as not accessible',
    async () => {
      const token = await mintToken()
      const client = new RawMcpClient({ token, url })
      await client.initialize()
      const message = await expectRejection(() =>
        client.callTool('klicker_lecturer_course_get', {
          courseId: randomUUID(),
        })
      )
      capturedMessages.push(message)
      assertNoLeak(message)
      assertSmoke(
        /FORBIDDEN|not found or not accessible/i.test(message),
        `expected a FORBIDDEN-style error, got: ${message}`
      )
      return 'course_get rejected as not accessible'
    }
  )

  // 10. Valid token, malformed (non-UUID) course id: rejected at the MCP
  // parameter-schema layer, before the tool's own execute() ever runs.
  await report.check(
    'malformed course id rejected at schema validation',
    async () => {
      const token = await mintToken()
      const client = new RawMcpClient({ token, url })
      await client.initialize()
      const message = await expectRejection(() =>
        client.callTool('klicker_lecturer_course_get', {
          courseId: 'not-a-uuid',
        })
      )
      capturedMessages.push(message)
      assertNoLeak(message)
      assertSmoke(
        /parameter validation failed|invalid uuid/i.test(message),
        `expected a schema validation error, got: ${message}`
      )
      return 'course_get rejected at schema validation'
    }
  )

  // 11. Valid token for a foreign sub (no seeded permissions): course_list
  // succeeds but returns zero courses rather than leaking other lecturers'
  // data.
  await report.check('foreign sub sees zero courses', async () => {
    const token = await mintToken({ sub: randomUUID() })
    const client = new RawMcpClient({ token, url })
    await client.initialize()
    const result = await client.callTool<CourseList>(
      'klicker_lecturer_course_list',
      { limit: 5 }
    )
    const courses = result.courses ?? []
    assertSmoke(Array.isArray(courses), 'courses missing')
    assertSmoke(
      courses.length === 0,
      `expected zero courses for a foreign sub, got ${courses.length}`
    )
    return '0 courses'
  })

  // 12. None of the captured negative-path error messages above leaked a
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
