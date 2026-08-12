import {
  ConcurrencyLimitStrategy,
  type JsonObject,
  Priority,
} from '@hatchet-dev/typescript-sdk/index.js'
import { hatchetClient } from '@klicker-uzh/hatchet'
import type {
  AssessmentResponseCommand,
  LiveQuizResponseInput,
} from '@klicker-uzh/types'
import { aggregateAssessmentResponses } from './processors/assessmentAggregation.js'
import { processAssessmentResponse } from './processors/assessmentProcessor.js'
import { processResponseMessage } from './processors/processor.js'

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

export const processAssessmentResponseWorkflow = hatchetClient.workflow<
  AssessmentResponseCommand<LiveQuizResponseInput> & JsonObject
>({
  name: 'process-assessment-response-workflow',
  defaultPriority: Priority.HIGH,
  onEvents: ['response-received:assessment'],
})
processAssessmentResponseWorkflow.durableTask({
  name: 'process-assessment-response',
  retries: 3,
  fn: (input, ctx) => processAssessmentResponse(input, ctx),
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
