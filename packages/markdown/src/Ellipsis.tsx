import { Prose, Tooltip } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import Markdown from './Markdown.js'

export interface EllipsisBaseProps {
  children: string
  maxLength?: number
  maxLines?: 1 | 2 | 3
  withoutPopup?: boolean
  className?: {
    root?: string
    tooltip?: string
    markdown?: string
    content?: string
  }
}

export interface EllipsisPropsMaxLength extends EllipsisBaseProps {
  maxLength: number
  maxLines?: never
}
export interface EllipsisPropsMaxLines extends EllipsisBaseProps {
  maxLength?: never
  maxLines: 1 | 2 | 3
}

export type EllipsisProps = EllipsisPropsMaxLength | EllipsisPropsMaxLines

function Ellipsis({
  children,
  maxLength,
  maxLines,
  withoutPopup = false,
  className,
}: EllipsisProps): React.ReactElement {
  if (maxLines) {
    return (
      <Tooltip
        delay={1000}
        tooltip={
          <Prose
            className={{
              root: 'flex-initial max-w-full leading-6 prose-p:m-0 sm:hover:text-white prose-img:m-0 ',
            }}
          >
            <Markdown
              withModal={false}
              content={children
                .toString()
                .replace(/^(- |[0-9]+\. |\* |\+ )/g, '')}
              className={{ root: className?.markdown, img: 'max-h-36' }}
            />
          </Prose>
        }
        className={{
          tooltip: twMerge(
            'text-sm bg-white border shadow max-w-md',
            className?.tooltip
          ),
        }}
        withIndicator={false}
      >
        <Prose
          className={{
            root: twMerge(
              'flex-initial max-w-full leading-6 prose-p:m-0 text-black sm:hover:text-black prose-img:m-0',
              // HACK: dynamic classnames do not work with tailwind
              // line-clamp-1 line-clamp-2 line-clamp-3
              // the above ensures classes 1-3 are present
              `line-clamp-${maxLines}`,
              className?.root,
              className?.content
            ),
          }}
        >
          <Markdown
            content={children
              .toString()
              .replace(/^(- |[0-9]+\. |\* |\+ )/g, '')}
            className={{ root: className?.markdown, img: 'max-h-16' }}
          />
        </Prose>
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
        root: 'flex-initial max-w-full leading-6 prose-p:m-0 text-black sm:hover:text-black',
      }}
    >
      <Markdown
        content={`${children
          .toString()
          .substr(0, endIndex || maxLength)
          .replace(/^(- |[0-9]+\. |\* |\+ )/g, '')} **...**`}
        className={{ root: className?.markdown, img: 'max-h-36' }}
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
    return (
      <Markdown
        content={children.toString().replace(/^(- |[0-9]+\. |\* |\+ )/g, '')}
        className={{ root: className?.markdown, img: 'max-h-36' }}
      />
    )
  }

  // return shortened content including tooltip with full content (if not explicitely disabled)
  return (
    <span className={className?.root}>
      {withoutPopup ? (
        shortenedParsedContent
      ) : (
        <Tooltip
          delay={1000}
          tooltip={
            <Markdown
              withModal={false}
              content={children
                .toString()
                .replace(/^(- |[0-9]+\. |\* |\+ )/g, '')}
              className={{ root: className?.markdown }}
            />
          }
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

export default Ellipsis
