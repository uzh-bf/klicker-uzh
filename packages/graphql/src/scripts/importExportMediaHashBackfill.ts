import { runBackfillCli } from '../lib/importExportOperations/backfill.js'
import { runOperationCli } from '../lib/importExportOperations/runtime.js'

const exitCode = await runOperationCli(
  'import-export-media-hash-backfill',
  async () => await runBackfillCli('media')
)
process.exitCode = exitCode
