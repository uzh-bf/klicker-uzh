import sanitizeHTML from 'sanitize-html'
import { stateToHTML } from 'draft-js-export-html'

function toSanitizedHTML(contentState) {
  try {
    // extract the current draftjs content state
    return (
      contentState
      |> stateToHTML // convert the content state to HTML
      |> sanitizeHTML // sanitize the resulting HTML
    )
  } catch (e) {
    console.error(`Failed sanitizing HTML... ${e}`)
  }

  return null
}

export { toSanitizedHTML }
