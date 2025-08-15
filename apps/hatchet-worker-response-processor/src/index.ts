import { hatchet } from './hatchet-client.js'
import { processResponseTask } from './processor.js'

async function main() {
  const worker = await hatchet.worker('hatchet-worker-response-processor', {
    workflows: [processResponseTask],
  })

  await worker.start()
}

if (require.main === module) {
  main()
}
