// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// import commands
import '@cypress/code-coverage/support'
import './commands'

// disable all animations and transitions during tests
Cypress.on('window:before:load', (win) => {
  // Method 1: Inject CSS to disable animations
  const disableAnimationsCSS = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
      animation-iteration-count: 1 !important;
      transition-property: none !important;
    }
  `

  const style = win.document.createElement('style')
  style.id = 'cypress-disable-animations'
  style.innerHTML = disableAnimationsCSS
  win.document.head.appendChild(style)
})

Cypress.on('test:before:run', () => {
  Cypress.automation('remote:debugger:protocol', {
    command: 'Emulation.setLocaleOverride',
    params: {
      locale: 'en',
    },
  })
})

// Gate fail-fast behavior behind an env flag (defaults to true for current behavior)
// Configure via `CYPRESS_FAIL_FAST=true|false` (or `--env FAIL_FAST=true|false`)
function envFlag(name: string, defaultValue = false): boolean {
  const raw = Cypress.env(name)
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw === 1
  if (typeof raw === 'string') {
    const v = raw.toLowerCase().trim()
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  }
  return defaultValue
}

// Single global hook: stop the run when a test fails and FAIL_FAST is enabled
Cypress.on('test:after:run', (test /*, runnable*/) => {
  if (envFlag('CYPRESS_FAIL_FAST', true) && test.state === 'failed') {
    Cypress.stop()
  }
})
