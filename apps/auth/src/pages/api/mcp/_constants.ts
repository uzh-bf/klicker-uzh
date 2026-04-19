// Access-token lifetime used by both /api/mcp/authorize (when signing the
// KlickerUZH JWT) and /api/mcp/token (when reporting `expires_in` back to
// the proxy). Keep in sync across both endpoints — the proxy rounds down
// to this value when presenting lifetime to MCP clients.
export const MCP_ACCESS_TOKEN_TTL_SECONDS = 12 * 60 * 60
export const MCP_ACCESS_TOKEN_TTL = `${MCP_ACCESS_TOKEN_TTL_SECONDS}s`
