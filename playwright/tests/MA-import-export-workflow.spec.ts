import { cleanupTest } from '../util/cleanup.js'
import { test } from '../util/fixtures.js'
import { registerImportExportSpec } from './import-export/spec-entry.js'
import { registerWorkflowImportExportCases } from './import-export/workflow-cases.js'

test('CLEANUP', cleanupTest)
registerImportExportSpec(registerWorkflowImportExportCases)
