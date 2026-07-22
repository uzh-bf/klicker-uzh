import {
  createOperationOutput,
  parseDatabaseTarget,
  requireMasterGateOff,
  runOperationCli,
} from '../lib/importExportOperations/runtime.js'
import { assertImportExportTokenSecretConfig } from '../lib/importExportTokenSecret.js'
import { checkImportExportPackageStorageReadiness } from '../services/packageStorage.js'

export async function runImportExportProductionPreflight(
  env: NodeJS.ProcessEnv = process.env
) {
  requireMasterGateOff(env)
  parseDatabaseTarget(env)
  assertImportExportTokenSecretConfig()

  // This entry point is production-only: a metadata-only check must never be
  // reported as release preflight evidence.
  const result = await checkImportExportPackageStorageReadiness({
    sasRoundTrip: true,
  })

  return createOperationOutput(
    'import-export-preflight',
    {
      outcome: 'success',
      code: 'PREFLIGHT_COMPLETE',
      checks: {
        masterGateOff: true,
        tokenSecretConfigured: true,
        packageStorageReady: true,
        sasRoundTrip: result.sasRoundTrip,
      },
    },
    env
  )
}

const exitCode = await runOperationCli(
  'import-export-preflight',
  async () => await runImportExportProductionPreflight()
)
process.exitCode = exitCode
