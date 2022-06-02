import React from 'react'
import useMarkdown from '../../lib/hooks/useMarkdown'
import SemanticCustomTooltip from './SemanticCustomTooltip'

interface Props {
  children: string
  maxLength?: number
  withoutPopup?: boolean
}

function Ellipsis({ children, maxLength, withoutPopup }: Props): React.ReactElement {
  const parsedContent = useMarkdown({
    content: children ? children.toString().replace(/^(- |[0-9]+\. |\* |\+ )/g, '') : 'no content',
  })

  const formulaRegex = RegExp(/(\${2})[^]*?[^\\]\1/gm)
  let endIndex = null

  // match first formula in an answer option
  let temp = formulaRegex.exec(children)

  // match all formulas in the answer options and break if they begin after maxLength (are cut anyways)
  // if the formulas begin before maxLength, but ends after it, include the formula in the output
  // (by setting endIndex correspondingly)
  while (temp !== null) {
    if (formulaRegex.lastIndex > maxLength) {
      if (temp.index > maxLength) {
        break
      } else {
        endIndex = formulaRegex.lastIndex
        break
      }
    }
    temp = formulaRegex.exec(children)
  }

  // compute shortened output based on either maxLength or endIndex
  const shortenedParsedContent = useMarkdown({
    content: children
      ? `${children
          .toString()
          .substr(0, endIndex || maxLength)
          .replace(/^(- |[0-9]+\. |\* |\+ )/g, '')} **...**`
      : 'no content',
  })

  // return full content if it was shorter than the set maxLength or if endIndex = children.length
  // (whole string is included in shortened version)
  if (children?.length <= maxLength || typeof children !== 'string' || children?.length === endIndex) {
    return parsedContent
  }

  // return shortened content including tooltip with full content (if not explicitely disabled)
  return (
    <span>
      {withoutPopup ? (
        shortenedParsedContent
      ) : (
        <SemanticCustomTooltip className={''} content={parsedContent} trigger={shortenedParsedContent} />
      )}
    </span>
  )
}

Ellipsis.defaultProps = {
  maxLength: 60,
  withoutPopup: false,
}

export default Ellipsis
