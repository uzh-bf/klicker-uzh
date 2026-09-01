import {
  ConcurrencyLimitStrategy,
  Priority,
} from '@hatchet-dev/typescript-sdk/index.js'
import { hatchetClient, withHatchetTaskLogging } from '@klicker-uzh/hatchet'
import { logger, loggerForInput } from './logger.js'
import {
  aggregateAssessmentResponses,
  type AssessmentResponseMessage,
  processAssessmentResponse,
} from './processors/assessmentProcessor.js'
import { processResponseMessage } from './processors/processor.js'

export const processAnonymousResponseTask = hatchetClient.task({
  name: 'process-anonymous-response',
  retries: 1,
  defaultPriority: Priority.MEDIUM,
  onEvents: ['response-received:anonymous'],
  fn: withHatchetTaskLogging({
    logger,
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
    logger,
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
    logger,
    taskName: 'process-assessment-response',
    handler: processAssessmentResponse,
  }),
})
processAssessmentResponseWorkflow.onFailure({
  name: 'log-assessment-response-failure',
  fn: withHatchetTaskLogging({
    logger,
    taskName: 'log-assessment-response-failure',
    handler: async (input, ctx) => {
      const message = '[ERROR] [AddResponse Assessment] Processing failed.'

      loggerForInput(input).error(
        { event: 'response.assessment.failed' },
        'Assessment response processing failed'
      )

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
    logger,
    taskName: 'aggregate-assessment-responses',
    handler: aggregateAssessmentResponses,
  }),
})

async function main() {
  const mode =
    process.env.ASSESSMENT_MODE === 'true' ? 'assessment' : 'live-quiz'
  const workflows =
    process.env.ASSESSMENT_MODE === 'true'
      ? [processAssessmentResponseWorkflow, aggregateAssessmentResponsesTask]
      : [processAuthenticatedResponseTask, processAnonymousResponseTask]

  logger.info(
    {
      event: 'hatchet.worker.starting',
      mode,
      workflowCount: workflows.length,
    },
    'Starting response processor worker'
  )

  const worker = await hatchetClient.worker(
    'hatchet-worker-response-processor',
    {
      workflows,
    }
  )

  await worker.start()

  logger.info(
    {
      event: 'hatchet.worker.started',
      mode,
      workflowCount: workflows.length,
    },
    'Response processor worker is ready'
  )
}

await main()
