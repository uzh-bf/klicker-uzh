// The layout hook reads storage during server rendering as well as in the browser.
export const liveQuizLayoutStorage: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem(key) {
    try {
      return typeof window === 'undefined'
        ? null
        : window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key, value) {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value)
      }
    } catch {
      // A storage restriction must not prevent participation in a live quiz.
    }
  },
}
