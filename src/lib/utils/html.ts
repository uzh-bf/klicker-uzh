import sanitizeHTML from 'sanitize-html'
import { stateToHTML } from 'draft-js-export-html'

export function toSanitizedHTML(contentState): string {
  try {
    // extract the current draftjs content state
    return sanitizeHTML(stateToHTML(contentState))
  } catch (e) {
    console.error(`Failed sanitizing HTML... ${e}`)
  }

  return null
}
