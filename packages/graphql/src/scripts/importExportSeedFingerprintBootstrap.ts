import {
  createOperationsPrisma,
  withAdvisoryLock,
} from '../lib/importExportOperations/database.js'
import { bootstrapSeededImportExportFingerprints } from '../services/importExportFingerprintMaintenance.js'

const prisma = createOperationsPrisma()
try {
  const result = await withAdvisoryLock({
    prisma,
    run: async (assertLockHeld) =>
      await bootstrapSeededImportExportFingerprints(prisma, {
        assertCanPersist: assertLockHeld,
      }),
  })
  process.stdout.write(
    `[seed] Import/export fingerprints ready: ${JSON.stringify(result)}\n`
  )
} finally {
  await prisma.$disconnect()
}
