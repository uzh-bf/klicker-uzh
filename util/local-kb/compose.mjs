import { renderBackingCompose } from './backing-compose.mjs'
import { renderDocProcessingCompose } from './doc-processing-compose.mjs'
import { renderIngestionCompose } from './ingestion-compose.mjs'
import { renderRetrievalCompose } from './retrieval-compose.mjs'
import { renderRetrievalStoreCompose } from './retrieval-store-compose.mjs'
import { renderScrapingCompose } from './scraping-compose.mjs'

// Render only the external-provider project. Klicker's managed checkout still
// needs explicit environment and network binding during isolated preparation.
export function renderProviderCompose(config) {
  const result = { name: config.project.identity, services: {}, volumes: {} }
  for (const render of [
    renderBackingCompose,
    renderIngestionCompose,
    renderScrapingCompose,
    renderDocProcessingCompose,
    renderRetrievalStoreCompose,
    renderRetrievalCompose,
  ]) {
    const fragment = render(config)
    for (const field of ['services', 'volumes']) {
      for (const [name, value] of Object.entries(fragment[field] ?? {})) {
        if (Object.hasOwn(result[field], name)) {
          throw new Error(`Duplicate local-KB ${field} definition: ${name}`)
        }
        result[field][name] = value
      }
    }
  }
  return result
}
