export const DOC_QUERY_MCP_SERVER_NAME = 'KB'
export const DOC_QUERY_TOOL_NAME = `${DOC_QUERY_MCP_SERVER_NAME}_doc_query`

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
    return (
      authType === 'scope_token' &&
      Boolean(context.kbId) &&
      Boolean(context.sessionId)
    )
  }

  if (authType !== 'scope_token') {
    return true
  }

  return false
}
