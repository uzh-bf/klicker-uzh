import React from 'react'
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts'

interface EvaluationConfusionProps {
  confusionTS: any
}
const EvaluationConfusion = ({ confusionTS }: EvaluationConfusionProps) => {
  console.log(confusionTS)

  // TODO: aggregate confusionTS data in some sense - e.g. that all inputs from within 2 min
  // are aggregated into a single value -> recharts then simply spreads the values evenly about time
  // by aggregating the values this chart can be used - otherwise data with similar timesteps would distort time
  return (
    <>
      <ResponsiveContainer width={700} height="40%" className="mb-4">
        <LineChart width={730} height={250} data={confusionTS} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="speed" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width={700} height="40%">
        <LineChart width={730} height={250} data={confusionTS} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="difficulty" stroke="#82ca9d" />
        </LineChart>
      </ResponsiveContainer>
    </>
  )
  return <div>Content Coming Soon</div>
}

export default EvaluationConfusion
