import React, { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import { repeat } from 'ramda'
import { Input, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ReferenceArea,
} from 'recharts'

import CustomTooltip from '../common/CustomTooltip'

interface EvaluationConfusionProps {
  confusionTS: any
}

function MatchingEmoji({ value }: any) {
  if (value <= -1.4 || value >= 1.4) {
    return <div>🙁</div>
  }

  if (value <= -0.7 || value >= 0.7) {
    return <div>😐</div>
  }

  return <div>😀</div>
}

function EvaluationConfusion({ confusionTS }: EvaluationConfusionProps) {
  const xIntervalDefault = 120
  const peakValue = 2 // hightest value that can be returned from a feedback (both positive and negative)
  const runningWindowDefault = 3
  const [xInterval, setXInterval] = useState(xIntervalDefault)
  const [runningWindow, setRunningWindow] = useState(runningWindowDefault)
  const [xIntervalError, setXIntervalError] = useState(false)
  const [runningWindowError, setRunningWindowError] = useState(false)

  // default settings: timesteps in plot 120 seconds, running average window 120 * 3 seconds
  const xDataInterval = xInterval || 120
  const runningAvgFactor = runningWindow || 3

  const confusionValues = useMemo(() => {
    if (confusionTS.length > 1) {
      const confusionInterval =
        dayjs(confusionTS[confusionTS.length - 1].createdAt).diff(dayjs(confusionTS[0].createdAt)) / 1000

      const numOfIntervals = Math.ceil(confusionInterval / xDataInterval)

      return repeat({}, numOfIntervals).map((_, k) => {
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
        return runningSum.numOfElements !== 0
          ? {
              speed: runningSum.speed / runningSum.numOfElements,
              difficulty: runningSum.difficulty / runningSum.numOfElements,
              numOfElements: runningSum.numOfElements,
              windowStart: startRunningInterval.format('HH:mm'),
            }
          : { speed: 0, difficulty: 0, numOfElements: 0, windowStart: startRunningInterval.format('HH:mm') }
      })
    }
    if (confusionTS.length === 1) {
      return [
        {
          speed: confusionTS[0].speed,
          difficulty: confusionTS[0].difficulty,
          numOfElements: 1,
          windowStart: dayjs(confusionTS[0].createdAt).format('HH:mm'),
        },
      ]
    }
    return []
  }, [confusionTS, xDataInterval, runningAvgFactor])

  return (
    <div className="flex flex-col justify-start h-full">
      <div className="flex-auto min-h-[10rem]">
        <div className="ml-2">
          <CustomTooltip
            tooltip={
              <FormattedMessage
                defaultMessage="The graphs below show all student confusion feedbacks that were received during the Klicker Session from beginning to end. The values are normalized to the interval [-1,1] and set to zero if there are no feedbacks in a given timeframe. The exact number of feedbacks per timeframe can be read by moving the cursor over the datapoints."
                id="evaluationSession.confusion.graphExplanation"
              />
            }
            tooltipStyle={'max-w-[20%] md:max-w-[30%]'}
            withArrow={false}
          >
            <Icon color="blue" name="question circle" />
          </CustomTooltip>
        </div>

        <ResponsiveContainer className="mb-4" height="70%" key="speedConfusion" width="95%">
          <LineChart data={confusionValues} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="6 6" />

            <XAxis dataKey="windowStart" />
            <YAxis domain={[-1 * peakValue, peakValue]} type="number" />

            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const difficulty = payload.find((item) => item.name === 'difficulty')
                  const speed = payload.find((item) => item.name === 'speed')
                  return (
                    <div className="p-2 text-gray-600 bg-white border border-gray-400 border-solid rounded">
                      <div className="font-bold">{payload[0].payload.windowStart}</div>
                      <div className="flex flex-row justify-between gap-4 mt-2">
                        <div className="font-bold">Avg. Difficulty</div>
                        <div>
                          <MatchingEmoji value={Number(difficulty?.value)} />
                        </div>
                      </div>
                      <div className="flex flex-row justify-between gap-4 mt-2">
                        <div className="font-bold">Avg. Speed</div>
                        <div>
                          <MatchingEmoji value={Number(speed?.value)} />
                        </div>
                      </div>
                      <div className="flex flex-row justify-between gap-4 mt-2">
                        <div className="font-bold">Feedbacks</div>
                        <div>{payload[0].payload.numOfElements}</div>
                      </div>
                    </div>
                  )
                }

                return null
              }}
            />
            <Legend align="right" verticalAlign="top" />

            <Line dataKey="speed" stroke="#8884d8" strokeOpacity={0.7} strokeWidth={2} type="monotone" />
            <Line dataKey="difficulty" stroke="#82ca9d" strokeOpacity={0.7} strokeWidth={2} type="monotone" />

            <ReferenceArea fill="green" fillOpacity={0.05} y1={-0.7} y2={0.7} />
            <ReferenceArea fill="orange" fillOpacity={0.05} y1={-0.7} y2={-1.4} />
            <ReferenceArea fill="orange" fillOpacity={0.05} y1={0.7} y2={1.4} />
            <ReferenceArea fill="red" fillOpacity={0.05} y1={1.4} y2={2.0} />
            <ReferenceArea fill="red" fillOpacity={0.05} y1={-1.4} y2={-2.0} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-initial p-3 lg:w-1/2">
        <div className="mb-2 font-bold ">Graph Settings</div>

        <div className="flex flex-row justify-between mb-2">
          <div className="w-48">Timesteps X-Axis</div>
          <div className="flex flex-row items-center flex-1 gap-2">
            <Input
              error={xIntervalError}
              key="intervalInput"
              // label="sec"
              // labelPosition="right"
              placeholder="min. 60s"
              onChange={(e, data) => {
                if (Number(data.value) >= 60) {
                  setXInterval(Number(data.value))
                  setXIntervalError(false)
                } else if (data.value === '') {
                  setXInterval(xIntervalDefault)
                  setXIntervalError(false)
                } else {
                  setXIntervalError(true)
                }
              }}
            />
            <div className="flex-initial">
              <CustomTooltip
                tooltip={
                  <FormattedMessage
                    defaultMessage="With this field, the timestep size used on the x-axis of the plot can be chosen in seconds. The minimum timestep is 60 seconds, the default one 120 seconds."
                    id="evaluationSession.confusion.timestep"
                  />
                }
                tooltipStyle={'max-w-[20%] md:max-w-[30%]'}
                withArrow={false}
              >
                <Icon color="blue" name="question circle" />
              </CustomTooltip>
            </div>
          </div>
        </div>
        <div className="flex flex-row justify-between dmb-2">
          <div className="w-48">Window Length</div>
          <div className="flex flex-row items-center flex-1 gap-2">
            <Input
              error={runningWindowError}
              key="windowLengthInput"
              // label="x"
              // labelPosition="right"
              placeholder="min. 1"
              onChange={(e, data) => {
                if (Number(data.value) >= 1) {
                  setRunningWindow(Number(data.value))
                  setRunningWindowError(false)
                } else if (data.value === '') {
                  setRunningWindow(runningWindowDefault)
                  setRunningWindowError(false)
                } else {
                  setRunningWindowError(true)
                }
              }}
            />
            <div className="flex-initial">
              <CustomTooltip
                tooltip={
                  <FormattedMessage
                    defaultMessage="This field allows to set a custom factor (multiplied by the x-timestep) for the running window over which the average is computed. The minimum factor is 1, the default one is 3."
                    id="evaluationSession.confusion.windowLength"
                  />
                }
                tooltipStyle={'max-w-[20%] md:max-w-[30%]'}
                withArrow={false}
              >
                <Icon color="blue" name="question circle" />
              </CustomTooltip>
            </div>
          </div>
        </div>
        <div className="mt-4">Displayed interval: {xDataInterval} seconds</div>
        <div>Displayed running window: {runningWindow} times interval</div>
      </div>
    </div>
  )
}

export default EvaluationConfusion
