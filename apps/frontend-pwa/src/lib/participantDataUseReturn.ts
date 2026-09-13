export function participantDataUseReturn(value: string, origin: string) {
  try {
    const destination = new URL(value, origin)
    if (
      destination.origin !== origin ||
      destination.pathname.endsWith('/account/data-use')
    ) {
      return '/'
    }
    for (const key of ['participantToken', 'signedLtiData', 'jwt', 'token']) {
      destination.searchParams.delete(key)
    }
    return destination.pathname + destination.search
  } catch {
    return '/'
  }
}
