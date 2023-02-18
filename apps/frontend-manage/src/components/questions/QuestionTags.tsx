import { Tag } from '@klicker-uzh/prisma'
import { ThemeContext } from '@uzh-bf/design-system'
import React, { useContext } from 'react'
import { twMerge } from 'tailwind-merge'

interface QuestionTagsProps {
  tags: Tag[]
  tagfilter?: string[]
}

const defaultProps = {
  tags: [],
  tagfilter: [],
}

function QuestionTags({
  tags,
  tagfilter,
}: QuestionTagsProps): React.ReactElement {
  const theme = useContext(ThemeContext)

  if (!tags || tags.length === 0) {
    return <></>
  }

  return (
    <div className="flex flex-row max-w-2xl overflow-auto">
      {tags.map(
        (tag): React.ReactElement => (
          <div
            className={twMerge(
              'py-1 px-3 m-1 mt-0 bg-slate-100 border border-solid rounded-md border-blue-40 w-max',
              tagfilter?.includes(tag.name) && theme.primaryBg
            )}
            key={tag.id}
          >
            {tag.name}
          </div>
        )
      )}
    </div>
  )
}

QuestionTags.defaultProps = defaultProps

export default QuestionTags
