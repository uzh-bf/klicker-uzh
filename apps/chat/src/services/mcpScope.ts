export const DOC_QUERY_MCP_SERVER_NAME = 'KB'
export const DOC_QUERY_TOOL_NAME = `${DOC_QUERY_MCP_SERVER_NAME}_doc_query`
export const DOC_QUERY_SCOPE_TOKEN_HEADER = 'X-Doc-Query-Scope-Token'

export function resolveMcpScopeSessionId({
  requestedThreadId,
  owningThreadId,
  fallbackId,
}: {
  requestedThreadId?: string | null
  owningThreadId?: string
  fallbackId: string
}): string | null {
  if (requestedThreadId && requestedThreadId !== owningThreadId) {
    return null
  }

  return owningThreadId ?? fallbackId
}

export function canLoadMCPServer(
  server: { name: string; authType: string },
  context: {
    chatbotId?: string
    participantId?: string
    kbId?: string
    sessionId?: string
  }
): boolean {
  const authType = server.authType.toLowerCase()

  if (server.name === DOC_QUERY_MCP_SERVER_NAME) {
    return Boolean(context.kbId) && Boolean(context.sessionId)
  }

  if (authType !== 'scope_token') {
    return true
  }

  return false
}
