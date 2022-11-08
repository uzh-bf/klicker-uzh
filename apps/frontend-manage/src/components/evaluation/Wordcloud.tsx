import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import React, { useMemo } from 'react'
import { TagCloud } from 'react-tagcloud'

interface WordcloudProps {
  data: InstanceResult
  showSolution: boolean // TODO: not implemented yet
}

function Wordcloud({ data }: WordcloudProps): React.ReactElement {
  const tags = useMemo(() => {
    return Object.values(data.results).map((result) => {
      return {
        count: result.count,
        value: result.value,
      }
    })
  }, [data])
  return (
    <div className="flex w-full h-full p-4">
      <TagCloud
        colorOptions={{ luminosity: 'dark' }}
        maxSize={60}
        minSize={18}
        shuffle={false}
        tags={tags}
      />
    </div>
  )
}

export default Wordcloud
