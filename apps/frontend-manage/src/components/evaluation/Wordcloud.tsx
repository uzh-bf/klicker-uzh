import { InstanceResult } from '@klicker-uzh/graphql/dist/ops'
import React, { useMemo } from 'react'
import { TagCloud } from 'react-tagcloud'

interface WordcloudProps {
  data: InstanceResult
  showSolution: boolean // TODO: not implemented yet
  textSize: 'sm' | 'md' | 'lg' | 'xl'
}

function Wordcloud({
  data,
  showSolution,
  textSize,
}: WordcloudProps): React.ReactElement {
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
        maxSize={
          textSize === 'sm'
            ? 40
            : textSize === 'lg'
            ? 70
            : textSize === 'xl'
            ? 80
            : 60
        }
        minSize={
          textSize === 'sm'
            ? 30
            : textSize === 'lg'
            ? 50
            : textSize === 'xl'
            ? 60
            : 40
        }
        shuffle={false}
        tags={tags}
      />
    </div>
  )
}

export default Wordcloud
