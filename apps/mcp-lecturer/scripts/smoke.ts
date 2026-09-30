import {
  RawMcpClient,
  SmokeReport,
  assertSmoke,
  assertTools,
  checkMcpHealth,
  envSource,
} from '../../../util/mcpSmokeClient.mjs'

const DEFAULT_URL = 'http://localhost:7081/mcp'
const DEFAULT_USER_ID = '76047345-3801-4628-ae7b-adbebcfe8821'
const DEFAULT_COURSE_ID = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
const DEFAULT_SCOPE = 'manage:read manage:draft'
const JWT_MODULE = '../src/jwt.js'
const EXPECTED_TOOLS = [
  'klicker_lecturer_capabilities',
  'klicker_lecturer_course_list',
  'klicker_lecturer_course_get',
  'klicker_lecturer_element_search',
  'klicker_lecturer_element_get',
  'klicker_lecturer_question_draft',
  'klicker_lecturer_choices_draft',
  'klicker_lecturer_feedback_draft',
  'klicker_lecturer_element_create_draft_proposal',
]

type LecturerCapabilities = {
  service?: string
  tools?: Array<{ name?: string }>
}

type SignLecturerJwt = (
  payload: {
    purpose: 'lecturer-mcp'
    role: 'USER'
    scope: string
    sub: string
  },
  secret: string,
  options: {
    expiresIn: string
    issuer: string
  }
) => Promise<string>

type CourseList = {
  courses?: Array<{ id?: string; name?: string }>
}

type ElementSearch = {
  elements?: Array<{ id?: number }>
}

type ProposalResult = {
  kind?: string
  proposalToken?: string
  requiresConfirmation?: boolean
}

function help() {
  console.log(`Lecturer MCP local smoke

Prerequisites:
  - database is running and seeded
  - apps/mcp-lecturer is running on the configured URL
  - APP_SECRET or MCP_LECTURER_JWT_SECRET and APP_ORIGIN_AUTH match the running service

Usage:
  pnpm --filter @klicker-uzh/mcp-lecturer smoke:local

Environment:
  MCP_LECTURER_SMOKE_URL       default ${DEFAULT_URL}
  MCP_LECTURER_SMOKE_USER_ID   default seeded lecturer
  MCP_LECTURER_SMOKE_COURSE_ID default seeded Testkurs
  MCP_LECTURER_SMOKE_SCOPE     default "manage:read manage:draft"
  APP_SECRET                   default abcd
  MCP_LECTURER_JWT_SECRET      default APP_SECRET
  APP_ORIGIN_AUTH              default http://localhost:3010

Options:
  --dry-run                    print resolved config without network calls
  --help                       show this help
`)
}

async function main() {
  if (process.argv.includes('--help')) {
    help()
    return 0
  }

  const url = process.env.MCP_LECTURER_SMOKE_URL ?? DEFAULT_URL
  const userId = process.env.MCP_LECTURER_SMOKE_USER_ID ?? DEFAULT_USER_ID
  const courseId = process.env.MCP_LECTURER_SMOKE_COURSE_ID ?? DEFAULT_COURSE_ID
  const scope = process.env.MCP_LECTURER_SMOKE_SCOPE ?? DEFAULT_SCOPE
  const issuer = process.env.APP_ORIGIN_AUTH ?? 'http://localhost:3010'
  const secret =
    process.env.MCP_LECTURER_JWT_SECRET ?? process.env.APP_SECRET ?? 'abcd'

  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify(
        {
          courseId: envSource(
            'MCP_LECTURER_SMOKE_COURSE_ID',
            'default seeded course'
          ),
          scope: envSource('MCP_LECTURER_SMOKE_SCOPE', DEFAULT_SCOPE),
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
  const { signLecturerJwt } = (await import(JWT_MODULE)) as {
    signLecturerJwt: SignLecturerJwt
  }
  const token = await signLecturerJwt(
    {
      purpose: 'lecturer-mcp',
      role: 'USER',
      scope,
      sub: userId,
    },
    secret,
    {
      expiresIn: '1h',
      issuer,
    }
  )
  const client = new RawMcpClient({ token, url })

  await report.check('health', () => checkMcpHealth(url))
  await report.check('initialize', async () => {
    const result = await client.initialize()
    assertSmoke(result, 'initialize returned no result')
    return 'initialized'
  })
  await report.check('list tools', async () =>
    assertTools(await client.listTools(), EXPECTED_TOOLS)
  )
  await report.check('capabilities', async () => {
    const capabilities = await client.callTool<LecturerCapabilities>(
      'klicker_lecturer_capabilities',
      {}
    )
    assertSmoke(capabilities.service === 'mcp-lecturer', 'wrong service')
    assertTools(capabilities.tools ?? [], EXPECTED_TOOLS)
    return `${capabilities.tools?.length ?? 0} policy summaries`
  })
  await report.check('list courses', async () => {
    const result = await client.callTool<CourseList>(
      'klicker_lecturer_course_list',
      { limit: 5 }
    )
    const courses = result.courses ?? []
    assertSmoke(Array.isArray(courses), 'courses missing')
    return `${courses.length} courses`
  })
  await report.check('get seeded course', async () => {
    const result = await client.callTool('klicker_lecturer_course_get', {
      courseId,
    })
    assertSmoke(result, 'course result missing')
    return courseId
  })
  await report.check('search elements', async () => {
    const result = await client.callTool<ElementSearch>(
      'klicker_lecturer_element_search',
      { limit: 1 }
    )
    assertSmoke(Array.isArray(result.elements), 'elements missing')
    return `${result.elements.length} elements`
  })
  await report.check('draft question', async () => {
    const result = await client.callTool('klicker_lecturer_question_draft', {
      topic: 'standard deviation smoke test',
      type: 'SC',
    })
    assertSmoke(result, 'draft missing')
    return 'drafted'
  })
  await report.check('create signed proposal', async () => {
    const result = await client.callTool<ProposalResult>(
      'klicker_lecturer_element_create_draft_proposal',
      {
        choices: [
          { correct: true, value: 'Variation or dispersion in the data' },
          { correct: false, value: 'The average value' },
        ],
        content: 'What does standard deviation measure?',
        explanation: 'Standard deviation summarizes dispersion.',
        name: 'Smoke standard deviation question',
        tags: ['smoke'],
        type: 'SC',
      }
    )
    assertSmoke(
      result.kind === 'element.create.proposal',
      'wrong proposal kind'
    )
    assertSmoke(
      result.requiresConfirmation === true,
      'confirmation not required'
    )
    assertSmoke(
      typeof result.proposalToken === 'string',
      'proposal token missing'
    )
    return 'proposal created without persistence'
  })

  return report.finish()
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
