import {
  ConcurrencyLimitStrategy,
  Priority,
} from '@hatchet-dev/typescript-sdk/index.js'
import {
  createHatchetClient,
  createHatchetWorkerRuntime,
  resolveWorkerRuntimeConfig,
  withHatchetTaskLogging,
} from '@klicker-uzh/hatchet'
import { logger } from './logger.js'
import {
  type AssessmentResponseMessage,
  aggregateAssessmentResponses,
  processAssessmentResponse,
} from './processors/assessmentProcessor.js'
import { processResponseMessage } from './processors/processor.js'
import {
  resolveResponseProcessorMode,
  resolveResponseProcessorWorkerMode,
  selectResponseProcessorWorkflows,
} from './mode.js'

const hatchetClient = createHatchetClient({ logger })

export const processAnonymousResponseTask = hatchetClient.task({
  name: 'process-anonymous-response',
  retries: 1,
  defaultPriority: Priority.MEDIUM,
  onEvents: ['response-received:anonymous'],
  fn: withHatchetTaskLogging({
    taskName: 'process-anonymous-response',
    handler: processResponseMessage,
  }),
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
  fn: withHatchetTaskLogging({
    taskName: 'process-authenticated-response',
    handler: processResponseMessage,
  }),
})

export const processAssessmentResponseWorkflow =
  hatchetClient.workflow<AssessmentResponseMessage>({
    name: 'process-assessment-response-workflow',
    defaultPriority: Priority.HIGH,
    onEvents: ['response-received:assessment'],
  })
processAssessmentResponseWorkflow.durableTask({
  name: 'process-assessment-response',
  retries: 3,
  fn: withHatchetTaskLogging({
    taskName: 'process-assessment-response',
    handler: processAssessmentResponse,
  }),
})
processAssessmentResponseWorkflow.onFailure({
  name: 'log-assessment-response-failure',
  fn: withHatchetTaskLogging({
    taskName: 'log-assessment-response-failure',
    handler: async (input, ctx) => {
      const message = '[ERROR] [AddResponse Assessment] Processing failed.'

      await ctx.logger.error('Assessment response processing failed', {
        extra: { event: 'response.assessment.failed' },
      })

      // push only an application-owned safe message to the audit log
      ctx.v1.events.push('create-audit-log-entry', {
        correlationId: input.correlationId,
        info: message,
        ...(input.loggingContext
          ? { loggingContext: input.loggingContext }
          : {}),
      })
    },
  }),
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
  fn: withHatchetTaskLogging({
    taskName: 'aggregate-assessment-responses',
    handler: aggregateAssessmentResponses,
  }),
})

async function main() {
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

  logger.info(
    {
      event: 'hatchet.worker.starting',
      mode,
      workflowCount: workflows.length,
    },
    'Starting response processor worker'
  )

  logger.info({ event: 'hatchet.worker.creating' }, 'Creating worker')
  const runtime = createHatchetWorkerRuntime({
    config: runtimeConfig,
    workflows,
    workerFactory: (name, options) => hatchetClient.worker(name, options),
  })

  logger.info({ event: 'hatchet.worker.starting_jobs' }, 'Starting response processing')
  await runtime.start()

  logger.info({ event: 'hatchet.worker.stopped', mode }, 'Response processor worker stopped')
  // The drain is complete here, but the Redis and Prisma clients opened above
  // keep the event loop alive and node runs as PID 1, so exit explicitly
  // instead of waiting for the kubelet's SIGKILL at the end of the grace period.
  process.exit(0)
}

await main()
