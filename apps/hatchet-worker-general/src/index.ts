import { prepareHatchetTasks } from '@klicker-uzh/hatchet-tasks'
import { hatchet } from './hatchet-client.js'

async function main() {
  const workflows = prepareHatchetTasks(hatchet)

  const worker = await hatchet.worker('hatchet-worker-general', {
    // TODO: figure out some way to share tasks with backend (e.g., try shared tasks package)
    // basic structure according to https://github.com/hatchet-dev/hatchet-typescript-quickstart/tree/main/monorepo
    workflows,
  })

  await worker.start()
}

if (require.main === module) {
  main()
}
