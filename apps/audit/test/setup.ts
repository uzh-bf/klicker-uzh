import { config } from 'dotenv'
import { resolve } from 'path'

// Load test environment variables before any tests run
config({ path: resolve(process.cwd(), '.env.test') })

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
