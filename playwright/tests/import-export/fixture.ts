import { expect as baseExpect, test } from '../../util/fixtures.js'
import {
  ImportExportIsolation,
  ImportExportTestUser,
  useIsolatedImportExportEnvironment,
} from '../../util/fixtures/importExportArtifacts.js'

function getImportExportTokenData(user: ImportExportTestUser) {
  return {
    email: user.email,
    sub: user.id,
    role: user.role,
    scope: 'ACCOUNT_OWNER' as const,
    catalystInstitutional: true,
    catalystIndividual: user.role === 'ADMIN',
  }
}

export const importExportTest = test.extend<{
  importExportIsolation: ImportExportIsolation
  trackImportExportArtifact: (artifactId: string) => void
}>({
  importExportIsolation: [
    async ({ page }, use) => {
      await useIsolatedImportExportEnvironment(page, use)
    },
    { auto: true, timeout: 300_000 },
  ],
  trackImportExportArtifact: async ({ importExportIsolation }, use) => {
    await use(importExportIsolation.trackArtifactId)
  },
  loginLecturer: async ({ importExportIsolation, loginFactory }, use) => {
    await use(async () => {
      await loginFactory(
        getImportExportTokenData(importExportIsolation.users.owner)
      )
    })
  },
  loginInstitutionalCatalyst: async (
    { importExportIsolation, loginFactory },
    use
  ) => {
    await use(async () => {
      await loginFactory(
        getImportExportTokenData(importExportIsolation.users.shared)
      )
    })
  },
  loginInstitutionalCatalyst2: async (
    { importExportIsolation, loginFactory },
    use
  ) => {
    await use(async () => {
      await loginFactory(
        getImportExportTokenData(importExportIsolation.users.importer)
      )
    })
  },
})

export const expect = baseExpect.configure({ timeout: 30_000 })
