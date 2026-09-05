import type { Request } from '@playwright/test'

function collectOperationNamesFromQuery(
  query: string,
  operationNames: Set<string>
) {
  for (const match of query.matchAll(
    /\b(?:query|mutation|subscription)\s+([_A-Za-z][_0-9A-Za-z]*)/g
  )) {
    if (match[1]) operationNames.add(match[1])
  }
}

function collectOperationNamesFromPayload(
  payload: unknown,
  operationNames: Set<string>
) {
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      collectOperationNamesFromPayload(entry, operationNames)
    }
    return
  }

  if (!payload || typeof payload !== 'object') return

  const operationName = Reflect.get(payload, 'operationName')
  if (typeof operationName === 'string' && operationName.length > 0) {
    operationNames.add(operationName)
  }

  const query = Reflect.get(payload, 'query')
  if (typeof query === 'string') {
    collectOperationNamesFromQuery(query, operationNames)
  }
}

export function getGraphqlOperationNames(request: Request) {
  const operationNames = new Set<string>()

  try {
    const url = new URL(request.url())
    const operationName = url.searchParams.get('operationName')
    if (operationName) operationNames.add(operationName)

    const query = url.searchParams.get('query')
    if (query) collectOperationNamesFromQuery(query, operationNames)
  } catch {
    // Playwright normally exposes an absolute URL. An invalid synthetic URL
    // cannot contribute a trustworthy operation name.
  }

  const postData = request.postData()
  if (postData) {
    try {
      collectOperationNamesFromPayload(JSON.parse(postData), operationNames)
    } catch {
      collectOperationNamesFromQuery(postData, operationNames)
    }
  }

  return operationNames
}

export function isGraphqlOperation(request: Request, operationName: string) {
  return getGraphqlOperationNames(request).has(operationName)
}
