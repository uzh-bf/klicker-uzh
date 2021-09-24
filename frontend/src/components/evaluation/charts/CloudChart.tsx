import React from 'react'
import WordCloud from 'react-d3-cloud'

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

const fontSizeMapper = (word): number => (1 + Math.log2(word.value)) * 40
const rotate = (word): number => word.value % 90

function CloudChart({ data, size }: Props): React.ReactElement {
  return (
    <div className="cloudChart">
      <WordCloud
        data={data.map(({ value, count }): any => ({ text: value, value: count }))}
        fontSize={fontSizeMapper}
        height={600}
        rotate={rotate}
        width={size.width || 600}
      />

      <style jsx>{`
        .cloudChart {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          width: 100%;
        }
      `}</style>
    </div>
  )
}

CloudChart.defaultProps = defaultProps

export default CloudChart
