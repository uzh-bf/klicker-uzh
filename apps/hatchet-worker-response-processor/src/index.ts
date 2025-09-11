import {
  ConcurrencyLimitStrategy,
  Priority,
} from '@hatchet-dev/typescript-sdk/index.js'
import { hatchetClient } from '@klicker-uzh/hatchet'
import type { ResponseInput } from '@klicker-uzh/types'
import {
  aggregateAssessmentResponses,
  processAssessmentResponse,
} from './assessmentProcessor.js'
import { processResponseMessage } from './processor.js'

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

// TODO: we need to incorporate logic for the durable task (https://docs.hatchet.run/home/durable-execution, https://docs.hatchet.run/home/durable-best-practices) to ensure its reliability
// TODO: or move to a https://docs.hatchet.run/home/dags as mentioned as a good alternative
// By following a few simple rules, you can ensure that your durable tasks are deterministic:
// Only call methods available on the DurableContext: a very common way to introduce non-determinism is to call methods within your application code which produces side effects. If you need to call a method in your application code which fetches data from a database, calls any sort of i/o operation, or otherwise interacts with other systems, you should spawn those tasks as a child task or child workflow using RunChild.
// When updating durable tasks, always guarantee backwards compatibility: if you change the order of operations in a durable task, you may break determinism. For example, if you call SleepFor followed by WaitFor, and then change the order of those calls, Hatchet will not be able to replay the task correctly. This is because the task may have already been checkpointed at the first call to SleepFor, and if you change the order of operations, the checkpoint is meaningless.

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
  sessionId: string
  instanceId: string
  response: ResponseInput
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
  const worker = await hatchetClient.worker(
    'hatchet-worker-response-processor',
    {
      workflows:
        process.env.ASSESSMENT_MODE === 'true'
          ? [
              processAssessmentResponseWorkflow,
              aggregateAssessmentResponsesTask,
            ]
          : [processAuthenticatedResponseTask, processAnonymousResponseTask],
    }
  )

  await worker.start()
}

await main()
