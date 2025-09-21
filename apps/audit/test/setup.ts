import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Load test environment variables before any tests run
const testEnvPath = resolve(process.cwd(), '.env.test')
const cypressEnvPath = resolve(process.cwd(), '.env.cypress')
const envPath = existsSync(testEnvPath) ? testEnvPath : cypressEnvPath

config({ path: envPath })

// Ensure critical environment variables are set
if (!process.env.INTERNAL_TOKEN) {
  throw new Error('INTERNAL_TOKEN environment variable is required for tests')
}

if (!process.env.AZURE_TABLES_CONNECTION_STRING) {
  throw new Error(
    'AZURE_TABLES_CONNECTION_STRING environment variable is required for tests'
  )
}

// Log test environment setup (for debugging)
console.log('🔧 Test environment loaded:')
console.log('   NODE_ENV:', process.env.NODE_ENV)
console.log(
  '   INTERNAL_TOKEN:',
  process.env.INTERNAL_TOKEN ? '***' : 'NOT SET'
)
console.log('   AZURE_TABLES_TABLE_NAME:', process.env.AZURE_TABLES_TABLE_NAME)
console.log('   APP_SECRET:', process.env.APP_SECRET ? '***' : 'NOT SET')
