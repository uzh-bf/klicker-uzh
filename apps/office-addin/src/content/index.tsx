import { createRoot } from 'react-dom/client'
import App from './components/App'

let isOfficeInitialized = false
let newlyInserted = false

function render(isOfficeInitialized: boolean, newlyInserted: boolean) {
  const container = document.getElementById('container')
  const root = createRoot(container!)

  root.render(
    <App
      isOfficeInitialized={isOfficeInitialized}
      newlyInserted={newlyInserted}
    />
  )
}

/* Render application after Office initializes */
// eslint-disable-next-line office-addins/no-office-initialize
Office.initialize = function (reason) {
  if (reason === Office.InitializationReason.Inserted) {
    newlyInserted = true
  }

  isOfficeInitialized = true

  render(isOfficeInitialized, newlyInserted)
}

// HACK: enable for browser-based dev
// render()
