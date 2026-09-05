import { importExportTest } from './fixture.js'

export function registerImportExportSpec(registerCases: () => void) {
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

    registerCases()
  })
}
