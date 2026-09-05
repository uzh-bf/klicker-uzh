import { cleanupTest } from '../util/cleanup.js'
import { test } from '../util/fixtures.js'
import { registerBasicImportExportCases } from './import-export/basic-cases.js'
import { registerImportExportSpec } from './import-export/spec-entry.js'

test('CLEANUP', cleanupTest)
registerImportExportSpec(registerBasicImportExportCases)
