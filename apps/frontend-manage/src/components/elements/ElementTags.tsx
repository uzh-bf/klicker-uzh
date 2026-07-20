import { Tag } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { twMerge } from 'tailwind-merge'

function ElementTags({
  tags = [],
  tagfilter = [],
  handleTagClick,
}: {
  tags: Tag[]
  tagfilter?: string[]
  handleTagClick: (tagId: number) => void
}): React.ReactElement {
  if (!tags || tags.length === 0) {
    return <></>
  }

  return (
    <div className="flex max-w-2xl flex-row gap-2 overflow-auto">
      {tags.map((tag) => {
        const selected = tagfilter?.includes(tag.id.toString())

        return (
          <Button
            className={{
              root: twMerge(
                'bg-uzh-grey-20 h-8',
                selected && 'bg-primary-20 hover:bg-primary-40/70'
              ),
            }}
            onClick={(event) => {
              event?.stopPropagation()
              handleTagClick(tag.id)
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

export default ElementTags
