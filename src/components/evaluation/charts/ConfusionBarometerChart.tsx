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
    <div className="confusionBarometerChart">
      <ResponsiveContainer>
        <ScatterChart
          height="100%"
          margin={{
            bottom: 0,
            left: 0,
            right: 0,
            top: 0,
          }}
          width="100%"
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
      <style jsx>
        {`
          @import 'src/theme';

          .confusionBarometerChart {
            height: 100%;
            width: 100%;
          }
        `}
      </style>
    </div>
  )
}

export default ConfusionBarometerChart
