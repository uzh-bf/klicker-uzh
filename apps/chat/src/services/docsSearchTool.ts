import { type ToolSet, tool } from 'ai'
import { z } from 'zod'
import docsManifest from '../../../docs/src/generated/docs-manifest.json'
import {
  formatKlickerDocsSearchOutcome,
  type KlickerDocsManifest,
  MAX_DOCS_QUERY_LENGTH,
  searchKlickerDocs,
} from './docsSearch'

// Reserved Chat-local tool name. The Manage assistant advertises this tool
// on every request — including requests whose lecturer MCP is degraded — so
// documentation help never depends on live backend tool health.
export const KLICKER_DOCS_SEARCH_TOOL_NAME = 'klicker_docs_search'

// Build-time import of the generated manifest: the search runs against the
// exact v3 docs snapshot bundled with this chat release, never a live fetch.
const manifest = docsManifest as unknown as KlickerDocsManifest

// Merges the Chat-local docs tools into the request's lecturer-MCP tool set.
// The docs tool name is reserved: a lecturer-side tool with the same name
// would silently shadow or be shadowed, so the request fails loudly instead.
export function mergeManageAssistantToolSets(
  lecturerTools: ToolSet,
  localTools: ToolSet
): ToolSet {
  for (const name of Object.keys(localTools)) {
    if (name in lecturerTools) {
      throw new Error(
        `Lecturer MCP tool '${name}' collides with a reserved Chat-local tool name`
      )
    }
  }
  return { ...lecturerTools, ...localTools }
}

export function createKlickerDocsSearchTool() {
  return tool({
    description:
      'Search the KlickerUZH public documentation snapshot bundled with this release (current v3 docs). Returns matching page titles, summaries, and source URLs for how-to and feature questions. The snapshot does not include changes made after this release.',
    inputSchema: klickerDocsSearchInputSchema,
    execute: async ({ query }) =>
      formatKlickerDocsSearchOutcome(searchKlickerDocs(manifest, query)),
  })
}

export const klickerDocsSearchInputSchema = z.object({
  query: z
    .string()
    .min(1)
    .max(MAX_DOCS_QUERY_LENGTH)
    .describe('Search terms, e.g. a feature or workflow name'),
})
