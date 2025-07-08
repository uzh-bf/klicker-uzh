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

  // Only polyfill PointerEvent if it's being used by RadixUI
  // This implementation avoids the constructor issue
  if (
    !win.PointerEvent ||
    win.PointerEvent.toString().includes('[native code]')
  ) {
    // Create a proper PointerEvent polyfill
    class PointerEventPolyfill extends win.MouseEvent {
      public pointerId: number
      public width: number
      public height: number
      public pressure: number
      public tangentialPressure: number
      public tiltX: number
      public tiltY: number
      public twist: number
      public pointerType: string
      public isPrimary: boolean

      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params)
        this.pointerId = params.pointerId || 0
        this.width = params.width || 1
        this.height = params.height || 1
        this.pressure = params.pressure || 0
        this.tangentialPressure = params.tangentialPressure || 0
        this.tiltX = params.tiltX || 0
        this.tiltY = params.tiltY || 0
        this.twist = params.twist || 0
        this.pointerType = params.pointerType || 'mouse'
        this.isPrimary = params.isPrimary || false
      }
    }

    // Apply the polyfill
    win.PointerEvent = PointerEventPolyfill as any
  }

  // Additional polyfills for RadixUI compatibility
  if (win.HTMLElement && win.HTMLElement.prototype) {
    win.HTMLElement.prototype.scrollIntoView = () => {}
    win.HTMLElement.prototype.hasPointerCapture = () => false
    win.HTMLElement.prototype.releasePointerCapture = () => {}
    win.HTMLElement.prototype.setPointerCapture = () => {}
  }
})
