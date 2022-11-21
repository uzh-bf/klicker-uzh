import { Tag } from '@klicker-uzh/prisma'
import React from 'react'

interface QuestionTagsProps {
  tags: Tag[]
}

const defaultProps = {
  tags: [],
}

function QuestionTags({ tags }: QuestionTagsProps): React.ReactElement {
  if (!tags || tags.length === 0) {
    return <></>
  }

  return (
    <div className="flex flex-row max-w-2xl overflow-auto">
      {tags.map(
        (tag): React.ReactElement => (
          <div
            className="p-1 px-2 m-1 mt-0 bg-white border border-solid rounded-md border-blue-40 w-max"
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
