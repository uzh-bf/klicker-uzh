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
