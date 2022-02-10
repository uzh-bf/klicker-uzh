import slate, { serialize } from 'remark-slate'
import unified from 'unified'
import markdown from 'remark-parse'

export const convertToMd = (slateObj) => {
  console.log('slateObj before conversion to MD')
  console.log(slateObj)
  const slateObjCopy = JSON.parse(JSON.stringify(slateObj))
  const result = slateObjCopy.map((line: any) => {
    if (line.type === 'block-quote') {
      return `>${serialize(line)}\n`
    }
    if (line.type === 'bulleted-list') {
      return serialize({
        type: 'bulleted-list',
        children: line.children.map((item: any) => {
          item.children.splice(0, 1, { type: 'list-item', text: `- ${formatText(item.children[0])}` })
          item.children.splice(item.children.length - 1, 1, {
            type: 'list-item',
            text: `${formatText(item.children[item.children.length - 1])}\n`,
          })
          return item
        }),
      })
    }
    if (line.type === 'numbered-list') {
      return serialize({
        type: 'numbered-list',
        children: line.children.map((item: any, index: number) => {
          item.children.splice(0, 1, {
            type: 'list-item',
            text: `${index + 1}. ${formatText(item.children[0])}`,
          })
          item.children.splice(item.children.length - 1, 1, {
            type: 'list-item',
            text: `${formatText(item.children[item.children.length - 1])}\n`,
          })

          return item
        }),
      })
    }
    return serialize(line)
  })
  console.log('output md')
  console.log(result.join('\n'))
  return result.join('\n')
}

export const convertToSlate = (mdObj) => {
  /* console.log('md before conversion to slate')
  console.log(mdObj)
  console.log('slate output object')
   */

  return unified()
    .use(markdown)
    .use(slate)
    .processSync(mdObj)
    .result.map((line: any) => {
      if (line.type === 'ol_list') {
        // return { ...line, type: 'numbered-list' }
        return {
          ...line,
          type: 'numbered-list',
          children: line.children.map((listItem: any) => {
            return {
              ...listItem,
              type: 'list-item',
              children: listItem.children[0].text !== '' ? listItem.children[0].children : [{ text: '' }],
            }
          }),
        }
      }
      if (line.type === 'ul_list') {
        // return { ...line, type: 'bulleted-list' }
        return {
          ...line,
          type: 'bulleted-list',
          children: line.children.map((listItem: any) => {
            return {
              ...listItem,
              type: 'list-item',
              children: listItem.children[0].text !== '' ? listItem.children[0].children : [{ text: '' }],
            }
          }),
        }
      }
      return line
    })
}

const formatText = (input) => {
  if (input.text === '') {
    return ''
  }
  return serialize({
    type: 'paragraph',
    text: input.text,
    bold: input.bold || false,
    italic: input.italic || false,
    code: input.code || false,
  }).replace(/(\r\n|\n|\r)/gm, '')
}
