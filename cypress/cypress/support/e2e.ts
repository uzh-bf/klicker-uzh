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

// Import commands.js using ES2015 syntax:
import './commands'

import '@cypress/code-coverage/support'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Disable all animations and transitions during tests
Cypress.on('window:before:load', (win) => {
  const style = win.document.createElement('style')
  style.innerHTML = `
    *, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }
  `
  win.document.head.appendChild(style)
})

// Mock PointerEvent for RadixUI compatibility
export class MockPointerEvent extends Event {
  button: number | undefined
  ctrlKey: boolean | undefined
  pointerType: string = 'mouse'
  pointerId: number = 1

  constructor(type: string, props: PointerEventInit | undefined) {
    super(type, props)
    if (props) {
      if (props.button != null) this.button = props.button
      if (props.ctrlKey != null) this.ctrlKey = props.ctrlKey
      if (props.pointerId != null) this.pointerId = props.pointerId
      if (props.pointerType != null) this.pointerType = props.pointerType
    }
  }
}

// Apply before each test
Cypress.on('window:before:load', (win) => {
  // Polyfill PointerEvent
  win.PointerEvent = MockPointerEvent as any
  win.HTMLElement.prototype.scrollIntoView = () => {}
  win.HTMLElement.prototype.hasPointerCapture = () => false
  win.HTMLElement.prototype.releasePointerCapture = () => {}
})
