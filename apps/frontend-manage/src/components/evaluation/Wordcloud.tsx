import React from 'react'
import { TagCloud } from 'react-tagcloud'

interface WordcloudProps {
  data: any
}

const defaultValues = {}

function Wordcloud({ data }: WordcloudProps): React.ReactElement {
  return (
    <div className="flex w-full h-full p-4">
      <TagCloud
        colorOptions={{ luminosity: 'dark' }}
        maxSize={60}
        minSize={18}
        shuffle={false}
        tags={data}
      />
    </div>
  )
}

export default Wordcloud
