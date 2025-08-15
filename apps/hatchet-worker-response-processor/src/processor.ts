import { hatchet } from './hatchet-client.js'

export type SimpleInput = {}

// TODO: implement logic of response processor function
export const processResponseTask = hatchet.task({
  name: 'process-response',
  retries: 3,
  fn: async (input: SimpleInput) => {
    return {
      hello: 'world',
    }
  },
})
