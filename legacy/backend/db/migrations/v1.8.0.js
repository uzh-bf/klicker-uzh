/* eslint-disable */

const fs = require('fs')

const converter = require('draftjs-md-converter')

const json = require('./questions_in.json')

/* after running this code, the solution will have overwritten / added the description and content attributes
  according to the following logic:
  - if the description is not undefined, keep it
  - if the description is undefined, replace it by the unformated content (only including newline characters)
  - if the content is not undefined, parse it from draftjs to markdown
  - if the content is undefined, simply set it equal to the description
  --> description contains plain question test, content contains markdown
*/
const mdDict = {
  BOLD: '**',
  ITALIC: '_',
}
const solution = json.map((elem) => {
  return {
    ...elem,
    versions: elem.versions.map((version) => {
      let descNew = ''
      let mdNew = ''
      const preprocessedContent = version.content
        ? {
            ...JSON.parse(version.content),
            blocks: JSON.parse(version.content)
              .blocks.filter((block) => (block.type !== 'atomic' ? block : null))
              .map((block) => {
                return {
                  ...block,
                  inlineStyleRanges: block.inlineStyleRanges.map((styles) => {
                    if ((styles.style = 'UNDERLINE')) {
                      styles.style = 'ITALIC'
                      return styles
                    }
                    return styles
                  }),
                }
              }),
          }
        : undefined
      if (typeof version.description !== 'undefined') {
        descNew = version.description
      } else {
        descNew = preprocessedContent.blocks
          .map((block) => block.text)
          .join('\n')
          .replace(/(\${2})[^]*?[^\\]\1/gm, '$FORMULA$')
          .match(/[\p{L}\p{N}\s]|[$Formula$]|[(0-9)+. ]|[- ]/gu)
          .join('')
      }
      if (typeof version.content !== 'undefined') {
        // any blocks with type: atomic will fail here - however, this only affects empty lines
        mdNew = converter
          .draftjsToMd(preprocessedContent, mdDict)
          .replace(/\*\*\s*_\s*([A-Za-z\s*]+)\s*_\s*\*\*/g, '***$1***')
      } else {
        mdNew = version.description ? version.description : ''
      }
      return { ...version, description: descNew, content: mdNew }
    }),
  }
})

fs.writeFile('./questions_out.json', JSON.stringify(solution), function (err) {
  if (err) {
    console.log(err)
  }
})
