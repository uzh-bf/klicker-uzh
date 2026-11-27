// Shared between the namespacing side (`services/mcpClients.ts`, which builds
// MCP tool names) and the matching side (`lib/sources/normalizeSources.ts`,
// whose regex has to recognize what that produced). They lived as separate
// literals in the two files; bumping one without the other would silently stop
// the source list, citation chips, activity chip and prompt contract from
// recognizing a disambiguated `doc_query`.
//
// This is a plain module rather than an export from `mcpClients.ts` because
// that file is `'use server'`, and such files may only export async functions.
export const MAX_TOOL_NAME_LENGTH = 64
export const TOOL_NAME_SUFFIX_LENGTH = 8
