import {
  ConcurrencyLimitStrategy,
  Priority,
} from '@hatchet-dev/typescript-sdk/index.js'
import { hatchetClient } from '@klicker-uzh/hatchet'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  CORRELATED_RESPONSE_WORKER_CAPABILITY_KEY,
  CORRELATED_RESPONSE_WORKER_CAPABILITY_TTL_SECONDS,
} from '@klicker-uzh/util'
import {
  aggregateAssessmentResponses,
  processAssessmentResponse,
} from './processors/assessmentProcessor.js'
import { processResponseMessage } from './processors/processor.js'
import { getRedis } from './redis.js'

export const processAnonymousResponseTask = hatchetClient.task({
  name: 'process-anonymous-response',
  retries: 1,
  defaultPriority: Priority.MEDIUM,
  onEvents: ['response-received:anonymous'],
  fn: processResponseMessage,
  // defaultFilters: [
  // TODO: what could we use filters for?
  //   {
  //     expression: 'input.cookie === undefined',
  //     scope: 'anonymous',
  //   },
  // ],
})

export const processAuthenticatedResponseTask = hatchetClient.durableTask({
  name: 'process-authenticated-response',
  retries: 3,
  defaultPriority: Priority.HIGH,
  onEvents: ['response-received:authenticated'],
  fn: processResponseMessage,
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

  const mode =
    process.env.ASSESSMENT_MODE === 'true' ? 'assessment' : 'live-quiz'
  const workflows =
    process.env.ASSESSMENT_MODE === 'true'
      ? [processAssessmentResponseWorkflow, aggregateAssessmentResponsesTask]
      : [processAuthenticatedResponseTask, processAnonymousResponseTask]

  console.log(`Mode: ${mode}`)
  console.log(`Workflows: ${workflows.length}`)

  if (mode === 'live-quiz') {
    const redis = getRedis()
    const refreshCapability = () =>
      redis.set(
        CORRELATED_RESPONSE_WORKER_CAPABILITY_KEY,
        'v1',
        'EX',
        CORRELATED_RESPONSE_WORKER_CAPABILITY_TTL_SECONDS
      )

    await refreshCapability()
    const capabilityHeartbeat = setInterval(
      () =>
        void refreshCapability().catch((error) =>
          console.error(
            'Failed to refresh correlated response worker capability',
            error
          )
        ),
      (CORRELATED_RESPONSE_WORKER_CAPABILITY_TTL_SECONDS * 1000) / 3
    )
    capabilityHeartbeat.unref()
  }

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
