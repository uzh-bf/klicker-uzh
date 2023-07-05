import {
  FreeTextQuestionData,
  InstanceResult,
  NumericalQuestionData,
} from '@klicker-uzh/graphql/dist/ops'
import React, { useMemo } from 'react'
import { TagCloud } from 'react-tagcloud'

interface WordcloudProps {
  data: InstanceResult
  showSolution: boolean // TODO: not implemented yet
  textSize: Record<string, number>
}

function Wordcloud({
  data,
  showSolution,
  textSize,
}: WordcloudProps): React.ReactElement {
  const tags = useMemo(() => {
    return Object.values(
      data.results as NumericalQuestionData | FreeTextQuestionData
    ).map((result) => {
      return {
        count: result.count,
        // value: <Markdown content={result.value} />,
        value: (result.value ?? '').replace(/[^a-zA-Z \n]/g, ''),
      }
    })
  }, [data])
  return (
    <div className="flex w-full h-full p-4">
      <TagCloud
        colorOptions={{ luminosity: 'dark' }}
        maxSize={textSize.max}
        minSize={textSize.min}
        shuffle={false}
        tags={tags}
      />
    </div>
  )
}

export default Wordcloud
