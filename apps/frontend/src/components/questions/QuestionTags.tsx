import React from 'react'

interface Props {
  tags: { id: string; name: string }[]
}

function QuestionTags({ tags }: Props): React.ReactElement {
  return (
    <div className="flex flex-row">
      {tags.map(
        (tag): React.ReactElement => (
          <div className="p-1 m-1 mt-0 bg-white border border-solid rounded-md border-blue-40 w-max" key={tag.id}>
            {tag.name}
          </div>
        )
      )}
    </div>
  )
}

export default QuestionTags
