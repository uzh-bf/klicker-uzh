const { convertToRaw, convertFromRaw, ContentState } = require('draft-js')

const createContentState = (text) => JSON.stringify(convertToRaw(ContentState.createFromText(text)))

// calculate the plain text question description from content state
const convertToPlainText = (content) => {
  let description

  try {
    // create a content state from the raw json definition
    const contentState = convertFromRaw(JSON.parse(content))

    // calculate the plain text description
    description = contentState.getPlainText(' ')
  } catch (e) {
    // if we were unable to calculate a description, return a placeholder string
    description = '-'
  }

  return description
}

module.exports = {
  createContentState,
  convertToPlainText,
}
