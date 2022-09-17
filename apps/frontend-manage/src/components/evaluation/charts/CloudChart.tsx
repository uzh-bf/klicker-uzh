import React from 'react'
import { TagCloud } from 'react-tagcloud'

interface Props {
  data?: {
    count: number
    value: string
  }[]
  size: {
    width: number
  }
}

const defaultProps = {
  data: [],
}

function CloudChart({ data }: Props): React.ReactElement {
  return (
    <div className="flex w-full h-full p-4">
      <TagCloud colorOptions={{ luminosity: 'dark' }} maxSize={60} minSize={18} shuffle={false} tags={data} />
      <style global jsx>{`
        .tag-cloud-tag {
          padding: 4px;
          padding-right: 16px;
        }
      `}</style>
    </div>
  )
}

CloudChart.defaultProps = defaultProps

export default CloudChart
