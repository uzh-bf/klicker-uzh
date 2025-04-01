import { runPermissionDerivationDemo } from './permissionDerivationDemo.js'

/**
 * Run the permission derivation tests
 */
async function runTests() {
  console.log('Running permission derivation tests...')

  // Run the demo with all test cases
  runPermissionDerivationDemo()

  console.log('\nAll tests completed!')
}

// Execute the tests
runTests().catch((error) => {
  console.error('Error running tests:', error)
  process.exit(1)
})
