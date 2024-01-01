import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface QuestionTagsProps {
  tags: Tag[]
  tagfilter?: string[]
  handleTagClick: (value: string, selected?: boolean) => void
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
    <div className="flex flex-row max-w-2xl overflow-auto">
      {tags.map((tag): React.ReactElement => {
        const selected = tagfilter?.includes(tag.name)

        return (
          <Button
            className={{
              root: twMerge(
                'py-1 px-3 m-1 mt-0 bg-slate-100 border border-solid rounded-md border-blue-40 w-max shadow-none',
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
