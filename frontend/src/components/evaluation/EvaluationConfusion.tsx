import React from 'react'
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts'

interface EvaluationConfusionProps {
  confusionTS: any
}
const EvaluationConfusion = ({ confusionTS }: EvaluationConfusionProps) => {
  // TODO: aggregation of confusion data - currently time-independent - always aggregationNumber values are grouped together
  const aggregationNumber = 5

  const tempConfusion = confusionTS
    .map((values) => {
      return { speed: values.speed, difficulty: values.difficulty }
    })
    .concat(Array(aggregationNumber - (confusionTS.length % aggregationNumber)).fill({ speed: 0, difficulty: 0 }))
  console.log(tempConfusion)

  let confusionValues = Array(tempConfusion.length / aggregationNumber)
  for (let k = 0; k < tempConfusion.length / aggregationNumber; k++) {
    confusionValues[k] = tempConfusion
      .slice(k * aggregationNumber, (k + 1) * aggregationNumber)
      .reduce((prev: any, curr: any) => {
        return { speed: prev.speed + curr.speed, difficulty: prev.difficulty + curr.difficulty }
      })
  }
  confusionValues = confusionValues.map((aggrValue) => {
    return { speed: aggrValue.speed / aggregationNumber, difficulty: aggrValue.difficulty / aggregationNumber }
  })
  console.log(confusionValues)

  return (
    <>
      <ResponsiveContainer width={700} height="40%" className="mb-4">
        <LineChart width={730} height={250} data={confusionValues} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis type="number" domain={[-1, 1]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="speed" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width={700} height="40%">
        <LineChart width={730} height={250} data={confusionValues} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis type="number" domain={[-1, 1]} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="difficulty" stroke="#82ca9d" />
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}

export default EvaluationConfusion
