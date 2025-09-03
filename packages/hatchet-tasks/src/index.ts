import { HatchetClient } from '@hatchet-dev/typescript-sdk'

export type SimpleInput = {}

export function prepareHatchetTasks(hatchet: HatchetClient) {
  // TODO: implement
  const doSomethingTask = hatchet.task({
    name: 'do-something',
    retries: 3,
    fn: async (input: SimpleInput) => {
      return {
        hello: 'world',
      }
    },
  })

  return [doSomethingTask]
}
