export function requiresSemanticEvaluatorStubToken(host) {
  return host !== '127.0.0.1'
}

export function isSemanticEvaluatorStubAuthorized(authorizationHeader, token) {
  return !token || authorizationHeader === `Bearer ${token}`
}
