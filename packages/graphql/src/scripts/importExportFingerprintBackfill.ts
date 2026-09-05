import { runBackfillCli } from '../lib/importExportOperations/backfill.js'
import { runOperationCli } from '../lib/importExportOperations/runtime.js'

const exitCode = await runOperationCli(
  'import-export-fingerprint-backfill',
  async () => await runBackfillCli('fingerprint')
)
process.exitCode = exitCode
