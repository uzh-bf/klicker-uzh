import { stateToHTML } from 'draft-js-export-html'
import sanitizeHTML from 'sanitize-html'

export function toSanitizedHTML(contentState): string {
  try {
    // extract the current draftjs content state
    return sanitizeHTML(stateToHTML(contentState))
  } catch (e) {
    console.error(`Failed sanitizing HTML... ${e}`)
  }

  return null
}
