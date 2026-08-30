import {
  ConcurrencyLimitStrategy,
  Priority,
} from '@hatchet-dev/typescript-sdk/index.js'
import {
  createHatchetWorkerRuntime,
  hatchetClient,
  resolveWorkerRuntimeConfig,
} from '@klicker-uzh/hatchet'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  aggregateAssessmentResponses,
  processAssessmentResponse,
} from './processors/assessmentProcessor.js'
import { processResponseMessage } from './processors/processor.js'
import {
  resolveResponseProcessorMode,
  resolveResponseProcessorWorkerMode,
  selectResponseProcessorWorkflows,
} from './mode.js'

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

  const mode = resolveResponseProcessorMode()
  const runtimeConfig = resolveWorkerRuntimeConfig(
    resolveResponseProcessorWorkerMode(mode)
  )
  const regularWorkflows = [
    processAuthenticatedResponseTask,
    processAnonymousResponseTask,
  ]
  const assessmentWorkflows = [
    processAssessmentResponseWorkflow,
    aggregateAssessmentResponsesTask,
  ]
  const workflows = selectResponseProcessorWorkflows({
    mode,
    regular: regularWorkflows,
    assessment: assessmentWorkflows,
  })

  console.log(`Mode: ${mode}`)
  console.log(`Workflows: ${workflows.length}`)

  console.log('Creating worker...')
  const runtime = createHatchetWorkerRuntime({
    config: runtimeConfig,
    workflows,
    workerFactory: (name, options) => hatchetClient.worker(name, options),
  })

  console.log('▶Starting worker to process responses...')
  await runtime.start()

  console.log('Response processor worker started successfully!')
}

await main()
