import Markdown from '@klicker-uzh/markdown'
import { Prose, Tooltip } from '@uzh-bf/design-system'
import Image from 'next/image'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface EllipsisProps {
  children: string
  maxLength?: number
  maxLines?: number
  withoutPopup?: boolean
  className?: {
    root?: string
    tooltip?: string
    markdown?: string
    content?: string
  }
}

interface EllipsisPropsMaxLength extends EllipsisProps {
  maxLength: number
  maxLines?: never
}
interface EllipsisPropsMaxLines extends EllipsisProps {
  maxLength?: never
  maxLines: number
}

function Ellipsis({
  children,
  maxLength,
  maxLines,
  withoutPopup,
  className,
}: EllipsisPropsMaxLength | EllipsisPropsMaxLines): React.ReactElement {
  const parsedContent = (
    <Markdown
      components={{
        img: ({ src, alt }: any) => (
          <Image src={src} alt="Image" width={50} height={50} />
        ),
      }}
      content={children.toString().replace(/^(- |[0-9]+\. |\* |\+ )/g, '')}
      className={className?.markdown}
    />
  )

  if (maxLines) {
    return (
      <Tooltip
        tooltip={
          <Prose
            className={{
              root: 'flex-initial max-w-full leading-6 prose-p:m-0 prose-invert text-white hover:text-white prose-img:m-0',
            }}
          >
            {parsedContent}
          </Prose>
        }
        className={{
          tooltip: twMerge(
            'text-sm max-w-[50%] md:max-w-[60%]',
            className?.tooltip
          ),
        }}
        withIndicator={false}
      >
        <div
          className={twMerge(
            'line-clamp-1 line-clamp-2 line-clamp-3',
            // HACK: dynamic classnames do not work with tailwind
            // the above ensures classes 1-3 are present
            `line-clamp-${maxLines}`,
            className?.root
          )}
        >
          <Prose
            className={{
              root: twMerge(
                'flex-initial max-w-full leading-6 prose-p:m-0 text-black hover:text-black prose-img:m-0',
                className?.content
              ),
            }}
          >
            {parsedContent}
          </Prose>
        </div>
      </Tooltip>
    )
  }

  if (!maxLength) {
    return <div>No content</div>
  }

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
  const shortenedParsedContent = (
    <Prose
      className={{
        root: 'flex-initial max-w-full leading-6 prose-p:m-0 text-black hover:text-black',
      }}
    >
      <Markdown
        content={`${children
          .toString()
          .substr(0, endIndex || maxLength)
          .replace(/^(- |[0-9]+\. |\* |\+ )/g, '')} **...**`}
        className={className?.markdown}
      />
    </Prose>
  )

  // return full content if it was shorter than the set maxLength or if endIndex = children.length
  // (whole string is included in shortened version)
  if (
    children.length <= maxLength ||
    typeof children !== 'string' ||
    children.length === endIndex
  ) {
    return parsedContent
  }

  // return shortened content including tooltip with full content (if not explicitely disabled)
  return (
    <span className={className?.root}>
      {withoutPopup ? (
        shortenedParsedContent
      ) : (
        <Tooltip
          tooltip={parsedContent}
          className={{
            tooltip: twMerge(
              'text-sm max-w-[50%] md:max-w-[60%]',
              className?.tooltip
            ),
          }}
          withIndicator={false}
        >
          {shortenedParsedContent}
        </Tooltip>
      )}
    </span>
  )
}

Ellipsis.defaultProps = {
  withoutPopup: false,
}

export default Ellipsis
