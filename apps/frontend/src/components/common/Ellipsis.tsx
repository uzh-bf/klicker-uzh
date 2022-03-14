import React from 'react'
import useMarkdown from '../../lib/hooks/useMarkdown'
import CustomTooltip from './CustomTooltip'

interface Props {
  children: string
  maxLength?: number
  withoutPopup?: boolean
}

function Ellipsis({ children, maxLength, withoutPopup }: Props): React.ReactElement {
  const parsedContent = useMarkdown({ content: children.replace(/^(- |[0-9]+. |\* |\+ )/g, '') })

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
    content: `${children.substr(0, endIndex || maxLength).replace(/^(- |[0-9]+. |\* |\+ )/g, '')} **...**`,
  })

  if (children.length <= maxLength || typeof children !== 'string') {
    return parsedContent
  }

  // return shortened content including tooltip with full content (if not explicitely disabled)
  return (
    <span title={children}>
      {withoutPopup ? (
        shortenedParsedContent
      ) : (
        <CustomTooltip className={''} content={parsedContent} iconObject={shortenedParsedContent} />
      )}
    </span>
  )
}

Ellipsis.defaultProps = {
  maxLength: 60,
  withoutPopup: false,
}

export default Ellipsis
