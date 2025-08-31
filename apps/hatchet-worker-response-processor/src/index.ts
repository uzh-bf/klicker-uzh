import { Priority } from '@hatchet-dev/typescript-sdk/index.js'
import { hatchetClient } from '@klicker-uzh/hatchet'
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

// TODO: should we have a third category for "assessment" responses?

async function main() {
  const worker = await hatchetClient.worker(
    'hatchet-worker-response-processor',
    {
      workflows: [
        processAuthenticatedResponseTask,
        processAnonymousResponseTask,
      ],
    }
  )

  await worker.start()
}

await main()
