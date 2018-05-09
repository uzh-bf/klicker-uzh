import sanitizeHTML from 'sanitize-html'
import { stateToHTML } from 'draft-js-export-html'
import { convertFromRaw } from 'draft-js'

function toSanitizedHTML(rawContent) {
  try {
    // extract the current draftjs content state
    return (
      rawContent
      |> convertFromRaw
      |> stateToHTML // convert the content state to HTML
      |> sanitizeHTML
    ) // sanitize the resulting HTML
  } catch (e) {
    console.error(`Failed sanitizing HTML... ${e}`)
  }

  return null
}

export { toSanitizedHTML }
