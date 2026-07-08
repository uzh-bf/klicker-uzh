import { assertImportExportTokenSecretConfig } from '../services/elementImportExport.js'
import { checkImportExportPackageStorageReadiness } from '../services/packageStorage.js'

async function run() {
  assertImportExportTokenSecretConfig()

  const result = await checkImportExportPackageStorageReadiness({
    sasRoundTrip: process.env.IMPORT_EXPORT_PREFLIGHT_SAS_ROUNDTRIP === 'true',
  })

  console.log(
    `[ImportExportProductionPreflight] OK container=${result.containerName} sasRoundTrip=${result.sasRoundTrip}`
  )
  console.log(
    '[ImportExportProductionPreflight] Reminder: browser CORS for SAS PUT/GET must still be validated from the frontend origin.'
  )
}

run().catch((error) => {
  console.error('[ImportExportProductionPreflight] FAILED', error)
  process.exit(1)
})
