import slate, { serialize } from 'remark-slate'
import unified from 'unified'
import markdown from 'remark-parse'

export const convertToMd = (slateObj) => {
  const slateObjCopy = JSON.parse(JSON.stringify(slateObj))
  const result = slateObjCopy.map((line: any) => {
    if (line.type === 'block-quote') {
      return `>${serialize(line)}\n`
    }
    if (line.type === 'bulleted-list') {
      return serialize({
        type: 'bulleted-list',
        children: line.children.map((item: any) => {
          item.children.splice(0, 1, { type: 'list-item', text: `- ${item.children[0].text}` })
          item.children.splice(item.children.length - 1, 1, {
            type: 'list-item',
            text: `${item.children[item.children.length - 1].text}\n`,
          })
          return item
        }),
      })
    }
    if (line.type === 'numbered-list') {
      return serialize({
        type: 'numbered-list',
        children: line.children.map((item: any, index: number) => {
          item.children.splice(0, 1, { type: 'list-item', text: `${index + 1}. ${item.children[0].text}` })
          item.children.splice(item.children.length - 1, 1, {
            type: 'list-item',
            text: `${item.children[item.children.length - 1].text}\n`,
          })
          return item
        }),
      })
    }
    return serialize(line)
  })
  return result.join('\n')
}

export const convertToSlate = (mdObj) => {
  return unified().use(markdown).use(slate).processSync(mdObj)
}
