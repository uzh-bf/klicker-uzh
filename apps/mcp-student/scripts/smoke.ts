import {
  RawMcpClient,
  SmokeReport,
  assertSmoke,
  assertTools,
  checkMcpHealth,
  envFlag,
  envSource,
} from '../../../util/mcpSmokeClient.mjs'

const DEFAULT_URL = 'http://localhost:7080/mcp'
const DEFAULT_PARTICIPANT_ID = '6f45065c-667f-4259-818c-c6f6b477eb48'
const DEFAULT_COURSE_ID = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
const DEFAULT_CHATBOT_ID = '8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f'
const JWT_MODULE = '@klicker-uzh/util'
const EXPECTED_TOOLS = [
  'klicker_student_capabilities',
  'lookup_relevant_practice_stacks',
  'get_practice_stack_for_quiz',
  'submit_practice_stack_answer',
]

type StudentCapabilities = {
  service?: string
  tools?: Array<{ name?: string }>
}

type SignJwt = (
  payload: Record<string, unknown>,
  secret: string,
  options: {
    algorithm: 'HS256'
    expiresIn: string
    issuer: string
  }
) => Promise<string>

type PracticeLookup = {
  candidates?: Array<{ questionRef?: string }>
}

type PracticeStack = {
  questionRef?: string
  stack?: {
    elements?: Array<{
      elementData?: {
        options?: {
          choices?: Array<{ ix?: number }>
          restrictions?: { min?: number }
        } | null
      }
      elementType?: string
      id?: number
    }>
  }
}

type PracticeElement = NonNullable<
  NonNullable<PracticeStack['stack']>['elements']
>[number]

function help() {
  console.log(`Student MCP local smoke

Prerequisites:
  - backend GraphQL is running and seeded
  - apps/mcp-student is running on the configured URL
  - APP_SECRET or MCP_STUDENT_JWT_SECRET and APP_ORIGIN_AUTH match the running services

Usage:
  pnpm --filter @klicker-uzh/mcp-student smoke:local
  MCP_STUDENT_SMOKE_SUBMIT=1 pnpm --filter @klicker-uzh/mcp-student smoke:local

Environment:
  MCP_STUDENT_SMOKE_URL             default ${DEFAULT_URL}
  MCP_STUDENT_SMOKE_PARTICIPANT_ID  default seeded testuser1
  MCP_STUDENT_SMOKE_COURSE_ID       default seeded Testkurs
  MCP_STUDENT_SMOKE_CHATBOT_ID      default seeded Benibot
  MCP_STUDENT_SMOKE_SUBMIT=1        also submit a derived placeholder answer
  APP_SECRET                        default abcd
  MCP_STUDENT_JWT_SECRET            default APP_SECRET
  APP_ORIGIN_AUTH                   default http://localhost:3010

Options:
  --dry-run                         print resolved config without network calls
  --help                            show this help
`)
}

function responseForElement(element: PracticeElement) {
  const instanceId = Number(element.id)
  const type = String(element.elementType)
  const choices = element.elementData?.options?.choices ?? []
  const base = { instanceId, type }

  if (['SC', 'MC', 'KPRIM'].includes(type)) {
    return {
      ...base,
      choicesResponse: choices.map((choice, ix) => ({
        ix: Number.isFinite(Number(choice.ix)) ? Number(choice.ix) : ix,
        selected: ix === 0,
      })),
    }
  }
  if (type === 'NUMERICAL') {
    return {
      ...base,
      numericalResponse: Number(
        element.elementData?.options?.restrictions?.min ?? 0
      ),
    }
  }
  if (type === 'FREE_TEXT') {
    return { ...base, freeTextResponse: 'Smoke test response' }
  }
  if (type === 'FLASHCARD') {
    return { ...base, flashcardResponse: 'CORRECT' }
  }

  throw new Error(`unsupported smoke response element type ${type}`)
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
  const submit = envFlag('MCP_STUDENT_SMOKE_SUBMIT')

  if (process.argv.includes('--dry-run')) {
    console.log(
      JSON.stringify(
        {
          chatbotId: envSource(
            'MCP_STUDENT_SMOKE_CHATBOT_ID',
            'default seeded chatbot'
          ),
          courseId: envSource(
            'MCP_STUDENT_SMOKE_COURSE_ID',
            'default seeded course'
          ),
          participantId: envSource(
            'MCP_STUDENT_SMOKE_PARTICIPANT_ID',
            'default seeded participant'
          ),
          submit,
          url: envSource('MCP_STUDENT_SMOKE_URL', DEFAULT_URL),
        },
        null,
        2
      )
    )
    return 0
  }

  const report = new SmokeReport()
  const { signJWT } = (await import(JWT_MODULE)) as { signJWT: SignJwt }
  const token = await signJWT(
    {
      actor: 'account',
      purpose: 'student-mcp',
      role: 'PARTICIPANT',
      scope: 'student:practice:read student:practice:submit',
      sub: participantId,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer,
    }
  )
  const client = new RawMcpClient({ token, url })
  let firstQuestionRef: string | undefined
  let fetchedStack: PracticeStack | undefined

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
    const capabilities = await client.callTool<StudentCapabilities>(
      'klicker_student_capabilities',
      {}
    )
    assertSmoke(capabilities.service === 'mcp-student', 'wrong service')
    assertTools(capabilities.tools ?? [], EXPECTED_TOOLS)
    return `${capabilities.tools?.length ?? 0} policy summaries`
  })
  await report.check('lookup relevant practice stacks', async () => {
    const lookup = await client.callTool<PracticeLookup>(
      'lookup_relevant_practice_stacks',
      {
        chatbotId,
        courseId,
        lastUserMessage: 'Smoke test: quiz me about this course.',
        limit: 1,
      }
    )
    assertSmoke(Array.isArray(lookup.candidates), 'candidates missing')
    const candidates = lookup.candidates
    firstQuestionRef = candidates[0]?.questionRef
    return `${candidates.length} candidates`
  })

  if (!firstQuestionRef) {
    report.skip('get practice stack', 'lookup returned no candidate')
    report.skip('submit practice answer', 'lookup returned no candidate')
    return report.finish()
  }

  await report.check('get practice stack', async () => {
    fetchedStack = await client.callTool<PracticeStack>(
      'get_practice_stack_for_quiz',
      { questionRef: firstQuestionRef }
    )
    const elements = fetchedStack.stack?.elements
    assertSmoke(Array.isArray(elements), 'stack elements missing')
    assertSmoke(elements.length > 0, 'stack has no elements')
    return `${elements.length} elements`
  })

  if (!submit) {
    report.skip(
      'submit practice answer',
      'set MCP_STUDENT_SMOKE_SUBMIT=1 to persist a placeholder answer'
    )
    return report.finish()
  }

  await report.check('submit practice answer', async () => {
    const elements = fetchedStack?.stack?.elements ?? []
    const result = await client.callTool('submit_practice_stack_answer', {
      questionRef: fetchedStack?.questionRef ?? firstQuestionRef,
      responses: elements.map(responseForElement),
      stackAnswerTimeSeconds: 1,
    })
    assertSmoke(result, 'submission returned no result')
    return 'submitted'
  })

  return report.finish()
}

try {
  process.exitCode = await main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
