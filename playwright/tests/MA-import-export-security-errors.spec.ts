import { cleanupTest } from '../util/cleanup.js'
import { test } from '../util/fixtures.js'
import { registerSecurityErrorImportExportCases } from './import-export/security-error-cases.js'
import { registerImportExportSpec } from './import-export/spec-entry.js'

test('CLEANUP', cleanupTest)
registerImportExportSpec(registerSecurityErrorImportExportCases)
