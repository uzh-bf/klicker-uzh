import { Prose, Tooltip } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import Markdown from './Markdown.js'

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea')
  textarea.innerHTML = text
  return textarea.value
}

export interface EllipsisBaseProps {
  children: string
  maxLength?: number
  maxLines?: 1 | 2 | 3
  withoutPopup?: boolean
  withMarkdown?: boolean
  withMarkdownTooltip?: boolean
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
  withMarkdown = true,
  withMarkdownTooltip = true,
  className,
}: EllipsisProps): React.ReactElement {
  if (maxLines) {
    return (
      <Tooltip
        delay={1000}
        tooltip={
          withMarkdownTooltip ? (
            <Prose
              className={{
                root: 'prose-p:m-0 prose-img:m-0 max-w-full flex-initial leading-6',
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
          ) : (
            children
          )
        }
        className={{
          tooltip: twMerge(
            'max-w-md border bg-white text-sm text-black shadow-sm',
            className?.tooltip
          ),
        }}
      >
        {withMarkdown ? (
          <Prose
            className={{
              root: twMerge(
                'prose-p:m-0 prose-img:m-0 max-w-full flex-initial leading-6 text-black hover:text-black',
                // HACK: dynamic classnames do not work with tailwind - ensure that the following classes are present:
                // line-clamp-1 line-clamp-2 line-clamp-3 line-clamp-4 line-clamp-5 line-clamp-6
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
        ) : (
          <div
            className={twMerge(
              `line-clamp-${maxLines}`,
              className?.root,
              className?.content
            )}
          >
            {typeof children === 'string'
              ? decodeHtmlEntities(children)
                  .split('\n')
                  .filter((line) => line.trim() !== '')
                  .slice(0, maxLines) // only include the first maxLines lines
                  .map((line, i, arr) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))
              : children}
          </div>
        )}
      </Tooltip>
    )
  }

  if (!maxLength) {
    return <div>No content</div>
  }

  const formulaRegex = RegExp(/(\${2})[\s\S]*?[^\\]\1/gm)
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
  const shortenedParsedContent = withMarkdown ? (
    <Prose
      className={{
        root: twMerge(
          'prose-p:m-0 max-w-full flex-initial leading-6 text-black hover:text-black',
          className?.content
        ),
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
  ) : (
    <div className={className?.content}>
      {decodeHtmlEntities(children.toString())
        .substr(0, endIndex || maxLength)
        .split('\n')
        .filter((line) => line.trim() !== '')
        .slice(0, 3) // Limit to 3 lines for shortened content
        .map((line, i, arr) => (
          <React.Fragment key={i}>
            {line}
            {i < arr.length - 1 && <br />}
          </React.Fragment>
        ))}
    </div>
  )

  // return full content if it was shorter than the set maxLength or if endIndex = children.length
  // (whole string is included in shortened version)
  if (
    children.length <= maxLength ||
    typeof children !== 'string' ||
    children.length === endIndex
  ) {
    return withMarkdown ? (
      <Markdown
        content={children.toString().replace(/^(- |[0-9]+\. |\* |\+ )/g, '')}
        className={{ root: className?.markdown, img: 'max-h-36' }}
      />
    ) : (
      <div className={className?.content}>
        {typeof children === 'string'
          ? decodeHtmlEntities(children)
              .split('\n')
              .filter((line) => line.trim() !== '')
              .slice(0, maxLines || 3) // Use maxLines if available, otherwise default to 3
              .map((line, i, arr) => (
                <React.Fragment key={i}>
                  {line}
                  {i < arr.length - 1 && <br />}
                </React.Fragment>
              ))
          : children}
      </div>
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
            withMarkdownTooltip ? (
              <Markdown
                withModal={false}
                content={children
                  .toString()
                  .replace(/^(- |[0-9]+\. |\* |\+ )/g, '')}
                className={{ root: className?.markdown }}
              />
            ) : typeof children === 'string' ? (
              <div>
                {decodeHtmlEntities(children)
                  .split('\n')
                  .filter((line) => line.trim() !== '')
                  .slice(
                    0,
                    maxLines || maxLength
                      ? Math.min(3, Math.ceil(maxLength / 50))
                      : 3
                  ) // limit lines based on context
                  .map((line, i, arr) => (
                    <React.Fragment key={i}>
                      {line}
                      {i < arr.length - 1 && <br />}
                    </React.Fragment>
                  ))}
              </div>
            ) : (
              children
            )
          }
          className={{
            tooltip: twMerge(
              'max-w-[50%] text-sm md:max-w-[60%]',
              className?.tooltip
            ),
          }}
        >
          {shortenedParsedContent}
        </Tooltip>
      )}
    </span>
  )
}

export default Ellipsis
