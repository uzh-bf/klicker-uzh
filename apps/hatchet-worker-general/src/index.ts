import { prepareHatchetTasks } from '@klicker-uzh/hatchet-tasks'
import { hatchet } from './hatchet-client.js'

async function main() {
  const workflows = prepareHatchetTasks(hatchet)
  const worker = await hatchet.worker('hatchet-worker-general', { workflows })
  await worker.start()
}

await main()
