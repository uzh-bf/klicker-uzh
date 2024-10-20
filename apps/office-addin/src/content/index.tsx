import React from 'react'
import ReactDOM from 'react-dom'
import App from './components/App'

declare const document, Office

let isOfficeInitialized = false
let newlyInserted = false

const render = (Component) => {
  ReactDOM.render(
    <Component
      isOfficeInitialized={isOfficeInitialized}
      newlyInserted={newlyInserted}
    />,
    document.getElementById('container')
  )
}

/* Render application after Office initializes */
// eslint-disable-next-line office-addins/no-office-initialize
Office.initialize = function (reason) {
  if (reason === Office.InitializationReason.Inserted) {
    newlyInserted = true
  }
  isOfficeInitialized = true
  render(App)
}

// HACK: enable for browser-based dev
// render(App);
