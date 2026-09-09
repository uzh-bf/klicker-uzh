import { cleanupTest } from '../util/cleanup.js'
import { test } from '../util/fixtures.js'
import { registerMediaUploadImportExportCases } from './import-export/media-upload-cases.js'
import { registerImportExportSpec } from './import-export/spec-entry.js'

test('CLEANUP', cleanupTest)
registerImportExportSpec(registerMediaUploadImportExportCases)
