import React from 'react'
import dayjs from 'dayjs'
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts'

interface EvaluationConfusionProps {
  confusionTS: any
}
const EvaluationConfusion = ({ confusionTS }: EvaluationConfusionProps) => {
  console.log(confusionTS)
  let confusionValues = []

  // current settings: timesteps in plot 120 seconds, running average window 120 * 3 seconds
  // TODO: make runningWindow parameters available to the user and set some default values
  const xDataInterval = 120
  const runningAvgFactor = 3
  const peakValue = 1 // hightest value that can be returned from a feedback (both positive and negative)

  if (confusionTS.length > 1) {
    const confusionInterval =
      dayjs(confusionTS[confusionTS.length - 1].createdAt).diff(dayjs(confusionTS[0].createdAt)) / 1000
    const NumOfIntervals = Math.ceil(confusionInterval / xDataInterval)

    confusionValues = Array(NumOfIntervals).fill({ speed: 0, difficulty: 0, NumOfElements: 0 })
    for (let k = 0; k < NumOfIntervals; k++) {
      const startRunningInterval = dayjs(confusionTS[0].createdAt).subtract(
        (runningAvgFactor - 1) * xDataInterval - k * xDataInterval,
        'seconds'
      )

      const runningSum = confusionTS
        .filter(
          (confusion) =>
            dayjs(confusion.createdAt).diff(startRunningInterval) > -1 * xDataInterval * 1000 &&
            dayjs(confusion.createdAt).diff(startRunningInterval) < runningAvgFactor * xDataInterval * 1000
        )
        .reduce(
          (prev: any, curr: any) => {
            return {
              speed: prev.speed + curr.speed,
              difficulty: prev.difficulty + curr.difficulty,
              numOfElements: prev.numOfElements + 1,
            }
          },
          { speed: 0, difficulty: 0, numOfElements: 0 }
        )

      // save confusion values normalized by number of feedbacks times possible peak Value
      // => result is always in the interval [-1,1]
      confusionValues[k] =
        runningSum.numOfElements !== 0
          ? {
              speed: runningSum.speed / (peakValue * runningSum.numOfElements),
              difficulty: runningSum.difficulty / (peakValue * runningSum.numOfElements),
              numOfElements: runningSum.numOfElements,
            }
          : { speed: 0, difficulty: 0, numOfElements: 0 }
    }
  }

  console.log(confusionValues)

  /* TIME INDEPENDENT AGGREGATION APPROACH

  const aggregationNumber = 5

  // create padded array of confusion logic that is dividable by aggregationNumber
  const tempConfusion = confusionTS
    .map((values) => {
      return {  speed: values.speed, difficulty: values.difficulty }
    })
    .concat(
      Array(aggregationNumber - (confusionTS.length % aggregationNumber)).fill({
        speed: 0,
        difficulty: 0,
      })
    )
  
  // aggregate confusion values (aggregationNumber values into one)
  let confusionValues = Array(tempConfusion.length / aggregationNumber).fill({ speed: 0, difficulty: 0 })
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
  */

  return (
    <>
      <ResponsiveContainer width={700} height="40%" className="mb-4">
        <LineChart width={730} height={250} data={confusionValues} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis type="number" domain={[-1, 1]} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="p-2 bg-white border border-gray-300 border-solid text-[#8884d8]">{`speed : ${
                    Math.round(Number(payload[0].value) * 100) / 100
                  }`}</div>
                )
              }

              return null
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="speed" stroke="#8884d8" />
        </LineChart>
      </ResponsiveContainer>
      <ResponsiveContainer width={700} height="40%">
        <LineChart width={730} height={250} data={confusionValues} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis type="number" domain={[-1, 1]} />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="p-2 bg-white border border-gray-300 border-solid text-[#82ca9d]">{`difficulty : ${
                    Math.round(Number(payload[0].value) * 100) / 100
                  }`}</div>
                )
              }

              return null
            }}
          />
          <Legend />
          <Line type="monotone" dataKey="difficulty" stroke="#82ca9d" />
        </LineChart>
      </ResponsiveContainer>
    </>
  )
}

export default EvaluationConfusion
