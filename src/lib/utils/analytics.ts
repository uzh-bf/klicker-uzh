import ReactGA from 'react-ga'

export function initGA(id: string): void {
  ReactGA.initialize(id)
}

export function logPageView(): void {
  ReactGA.set({ page: window.location.pathname })
  ReactGA.pageview(window.location.pathname)
}

export function logEvent(category = '', action = ''): void {
  if (category && action) {
    ReactGA.event({ action, category })
  }
}

export function logException(description = '', fatal = false): void {
  if (description) {
    ReactGA.exception({ description, fatal })
  }
}
