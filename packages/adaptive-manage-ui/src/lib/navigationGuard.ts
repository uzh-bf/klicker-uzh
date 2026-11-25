type NavigationBlocker = () => boolean

const navigationBlockers = new Set<NavigationBlocker>()

export function registerNavigationBlocker(blocker: NavigationBlocker) {
  navigationBlockers.add(blocker)
  return () => navigationBlockers.delete(blocker)
}

export function requestNavigationConfirmation() {
  return Array.from(navigationBlockers).every((blocker) => blocker())
}
