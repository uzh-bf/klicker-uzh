import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Load test environment variables before any tests run
const testEnvPath = resolve(process.cwd(), '.env.test')
const cypressEnvPath = resolve(process.cwd(), '.env.cypress')
const envPath = existsSync(testEnvPath) ? testEnvPath : cypressEnvPath

config({ path: envPath })

// Ensure critical environment variables are set
if (!process.env.AUDIT_TOKEN) {
  throw new Error('AUDIT_TOKEN environment variable is required for tests')
}

if (!process.env.AUDIT_TABLE_CONNECTION_STRING) {
  throw new Error(
    'AUDIT_TABLE_CONNECTION_STRING environment variable is required for tests'
  )
}

// Log test environment setup (for debugging)
console.log('🔧 Test environment loaded:')
console.log('   NODE_ENV:', process.env.NODE_ENV)
console.log('   AUDIT_TOKEN:', process.env.AUDIT_TOKEN ? '***' : 'NOT SET')
console.log('   AUDIT_TABLE_NAME:', process.env.AUDIT_TABLE_NAME)
console.log('   APP_SECRET:', process.env.APP_SECRET ? '***' : 'NOT SET')
