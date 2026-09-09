import { cleanupTest } from '../util/cleanup.js'
import { test } from '../util/fixtures.js'
import { registerDidacticPerformanceImportExportCases } from './import-export/didactic-performance-cases.js'
import { registerImportExportSpec } from './import-export/spec-entry.js'

test('CLEANUP', cleanupTest)
registerImportExportSpec(registerDidacticPerformanceImportExportCases)
