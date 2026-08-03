import { resolve } from 'node:path'
import { writeSimulationReport } from './simulationReport.js'

await writeSimulationReport({
  reportDirectory: resolve(process.cwd(), 'reports'),
})
