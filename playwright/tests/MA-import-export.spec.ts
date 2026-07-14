import { cleanupTest } from '../util/cleanup.js'
import { test } from '../util/fixtures.js'
import { registerBasicImportExportCases } from './import-export/basic-cases.js'
import { registerDidacticPerformanceImportExportCases } from './import-export/didactic-performance-cases.js'
import { importExportTest } from './import-export/fixture.js'
import { registerSecurityErrorImportExportCases } from './import-export/security-error-cases.js'
import { registerWorkflowImportExportCases } from './import-export/workflow-cases.js'

test('CLEANUP', cleanupTest)

importExportTest.describe('Element import/export packages', () => {
  importExportTest.describe.configure({ timeout: 120_000 })
  importExportTest.use({
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    serviceWorkers: 'block',
  })

  importExportTest.beforeEach(async ({ loginLecturer }) => {
    await loginLecturer()
  })

  registerBasicImportExportCases()
  registerWorkflowImportExportCases()
  registerDidacticPerformanceImportExportCases()
  registerSecurityErrorImportExportCases()
})
