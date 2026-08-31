import {
  ConcurrencyLimitStrategy,
  type JsonObject,
  Priority,
} from '@hatchet-dev/typescript-sdk/index.js'
import { hatchetClient } from '@klicker-uzh/hatchet'
import { prisma } from '@klicker-uzh/prisma'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  aggregateAssessmentResponses,
  processAssessmentResponse,
} from './processors/assessmentProcessor.js'
import {
  type LiveQuizResponseMessage,
  processResponseMessage,
} from './processors/processor.js'

async function terminalizeFailedResponseAdmission(input: JsonObject) {
  const responseLeaseToken = input.responseLeaseToken
  const sessionId = input.sessionId
  if (typeof responseLeaseToken !== 'string' || typeof sessionId !== 'string') {
    return 0
  }

  const result = await prisma.liveQuizResponseAdmission.updateMany({
    where: {
      token: responseLeaseToken,
      liveQuizId: sessionId,
      failedAt: null,
    },
    data: { failedAt: new Date() },
  })
  return result.count
}

export const processAnonymousResponseWorkflow = hatchetClient.workflow({
  name: 'process-anonymous-response',
  defaultPriority: Priority.MEDIUM,
  onEvents: ['response-received:anonymous'],
})
processAnonymousResponseWorkflow.task({
  name: 'process-anonymous-response',
  retries: 1,
  fn: async (input, ctx) => {
    await processResponseMessage(
      input as unknown as LiveQuizResponseMessage,
      ctx
    )
  },
  // defaultFilters: [
  // TODO: what could we use filters for?
  //   {
  //     expression: 'input.cookie === undefined',
  //     scope: 'anonymous',
  //   },
  // ],
})
processAnonymousResponseWorkflow.onFailure({
  name: 'terminalize-anonymous-response-admission',
  retries: 10,
  fn: async (input, ctx) => {
    const count = await terminalizeFailedResponseAdmission(input)
    ctx.logger.error(
      `Anonymous response processing retries exhausted; terminalized admissions: ${count}`
    )
  },
})

export const processAuthenticatedResponseWorkflow = hatchetClient.workflow({
  name: 'process-authenticated-response',
  defaultPriority: Priority.HIGH,
  onEvents: ['response-received:authenticated'],
})
processAuthenticatedResponseWorkflow.durableTask({
  name: 'process-authenticated-response',
  retries: 3,
  fn: async (input, ctx) => {
    await processResponseMessage(
      input as unknown as LiveQuizResponseMessage,
      ctx
    )
  },
})
processAuthenticatedResponseWorkflow.onFailure({
  name: 'terminalize-authenticated-response-admission',
  retries: 10,
  fn: async (input, ctx) => {
    const count = await terminalizeFailedResponseAdmission(input)
    ctx.logger.error(
      `Authenticated response processing retries exhausted; terminalized admissions: ${count}`
    )
  },
})

export const processAssessmentResponseWorkflow = hatchetClient.workflow<{
  correlationId: string
  participantId: string
  liveQuizId: string
  instanceId: string
  response: LiveQuizResponseInput
  cookie?: string
  responseTimestamp: number
}>({
  name: 'process-assessment-response-workflow',
  defaultPriority: Priority.HIGH,
  onEvents: ['response-received:assessment'],
})
processAssessmentResponseWorkflow.durableTask({
  name: 'process-assessment-response',
  retries: 3,
  fn: (input, ctx) => processAssessmentResponse(input, ctx),
})
processAssessmentResponseWorkflow.onFailure({
  name: 'log-assessment-response-failure',
  fn: async (input, ctx) => {
    const error = JSON.stringify(ctx.errors)
    const message = `[ERROR] [AddResponse Assessment] ${error}.`

    // log the error
    ctx.logger.error(message)

    // push the error to the audit log
    ctx.v1.events.push('create-audit-log-entry', {
      correlationId: input.correlationId,
      info: message,
    })
  },
})

export const aggregateAssessmentResponsesTask = hatchetClient.durableTask({
  name: 'aggregate-assessment-responses',
  retries: 1,
  defaultPriority: Priority.MEDIUM,
  concurrency: {
    expression: 'input.instanceId', // use the instance id as a concurrency key to ensure only a single aggregation task is running per instance
    maxRuns: 1, // per instance, only a single aggregation task should be running at a time
    limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
  },
  onEvents: ['response-processed:aggregation'],
  fn: aggregateAssessmentResponses,
})

async function main() {
  console.log('Starting response processor worker...')

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for response processing')
  }
  await prisma.$connect()
  console.log('Database connection established')

  const mode =
    process.env.ASSESSMENT_MODE === 'true' ? 'assessment' : 'live-quiz'
  const workflows =
    process.env.ASSESSMENT_MODE === 'true'
      ? [processAssessmentResponseWorkflow, aggregateAssessmentResponsesTask]
      : [processAuthenticatedResponseWorkflow, processAnonymousResponseWorkflow]

  console.log(`Mode: ${mode}`)
  console.log(`Workflows: ${workflows.length}`)

  console.log('Creating worker...')
  const worker = await hatchetClient.worker(
    'hatchet-worker-response-processor',
    {
      workflows,
    }
  )

  console.log('▶Starting worker to process responses...')
  await worker.start()

  console.log('Response processor worker started successfully!')
}

await main()
