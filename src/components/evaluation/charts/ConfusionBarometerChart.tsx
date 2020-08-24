import React from 'react'
import dayjs from 'dayjs'

import {
  Legend,
  ScatterChart,
  Scatter,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Label,
} from 'recharts'

interface Props {
  confusionTS: any[]
}

function ConfusionBarometerChart({ confusionTS }: Props): React.ReactElement {
  const parsedTS = confusionTS.reduce((acc, { createdAt, speed, difficulty }): any[] => {
    return [
      ...acc,
      {
        difficulty,
        speed,
        timestamp: dayjs(createdAt).format('H:mm:ss'),
      },
    ]
  }, [])

  return (
    <ResponsiveContainer>
      <ScatterChart
        margin={{
          bottom: 10,
          left: 0,
          right: 10,
          top: 10,
        }}
      >
        <CartesianGrid strokeDasharray="5 5" />
        <XAxis dataKey="timestamp" padding={{ right: 10 }} xAxisId={0} />
        <YAxis
          dataKey="value"
          domain={[-5, 5]}
          minTickGap={1}
          padding={{ bottom: 10, top: 10 }}
          ticks={[-5, -2.5, 0, 2.5, 5]}
        >
          <Label angle={-90} position="insideLeft" style={{ textAnchor: 'middle' }} />
        </YAxis>
        <ZAxis range={[200, 200]} />
        <ReferenceLine stroke="black" y={0} />
        <Legend />
        <Scatter
          data={parsedTS.map(({ timestamp, difficulty }): any => ({
            timestamp,
            value: difficulty,
          }))}
          fill="#8884d8"
          line={false}
          name="Difficulty"
          xAxisId="0"
        />
        <Scatter
          data={parsedTS.map(({ timestamp, speed }): any => ({
            timestamp,
            value: speed,
          }))}
          fill="#82ca9d"
          line={false}
          name="Speed"
          xAxisId={0}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default ConfusionBarometerChart
