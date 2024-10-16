import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface QuestionTagsProps {
  tags: Tag[]
  tagfilter?: string[]
  handleTagClick: (tagName: string) => void
}

function QuestionTags({
  tags = [],
  tagfilter = [],
  handleTagClick,
}: QuestionTagsProps): React.ReactElement {
  if (!tags || tags.length === 0) {
    return <></>
  }

  return (
    <div className="flex max-w-2xl flex-row overflow-auto">
      {tags.map((tag): React.ReactElement => {
        const selected = tagfilter?.includes(tag.name)

        return (
          <Button
            className={{
              root: twMerge(
                'border-blue-40 m-1 mt-0 w-max rounded-md border border-solid bg-slate-100 px-3 py-1 shadow-none',
                selected && 'bg-primary-20'
              ),
            }}
            onClick={(event) => {
              event?.stopPropagation()
              handleTagClick(tag.name)
            }}
            key={tag.id}
            data={{ cy: `tag-list-item-${tag.name}` }}
          >
            {tag.name}
          </Button>
        )
      })}
    </div>
  )
}

export default QuestionTags
