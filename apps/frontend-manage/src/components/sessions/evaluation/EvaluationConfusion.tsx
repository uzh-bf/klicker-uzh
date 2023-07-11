import { faQuestion } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ConfusionTimestep } from '@klicker-uzh/graphql/dist/ops'
import { FormikTextField, Tooltip } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { repeat } from 'ramda'
import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip as RechartsTooltip,
  ReferenceArea,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import * as yup from 'yup'

interface EvaluationConfusionProps {
  confusionTS: ConfusionTimestep[]
}

function MatchingEmoji({ value }: { value: number }) {
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

  // default settings: timesteps in plot 120 seconds, running average window 120 * 3 seconds
  const xDataInterval = xInterval || 120
  const runningAvgFactor = runningWindow || 3

  const confusionValues = useMemo(() => {
    if (confusionTS.length > 1) {
      const confusionInterval =
        dayjs(confusionTS[confusionTS.length - 1].createdAt).diff(
          dayjs(confusionTS[0].createdAt)
        ) / 1000

      const numOfIntervals = Math.ceil(confusionInterval / xDataInterval)

      return repeat({}, numOfIntervals).map((_, k) => {
        const startRunningInterval: dayjs.Dayjs = dayjs(
          confusionTS[0].createdAt
        ).subtract(
          (runningAvgFactor - 1) * xDataInterval - k * xDataInterval,
          'seconds'
        )

        const runningSum: {
          speed: number
          difficulty: number
          numOfElements: number
        } = confusionTS
          .filter(
            (confusion) =>
              dayjs(confusion.createdAt).diff(startRunningInterval) >
                -1 * xDataInterval * 1000 &&
              dayjs(confusion.createdAt).diff(startRunningInterval) <
                runningAvgFactor * xDataInterval * 1000
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
          : {
              speed: 0,
              difficulty: 0,
              numOfElements: 0,
              windowStart: startRunningInterval.format('HH:mm'),
            }
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

  const confusionGraphSchema = yup.object().shape({
    xInterval: yup
      .number()
      .min(60, 'Die Schrittweite muss mindestens 60 Sekunden betragen.')
      .required('Bitte geben Sie eine gültige Mindestschrittweite ein.'),
    windowLength: yup
      .number()
      .min(1, 'Die Fensterlänge muss mindestens 1 betragen.')
      .required('Bitte geben Sie eine gültige Fensterlänge ein.'),
  })

  return (
    <div className="flex flex-col justify-start h-full">
      <div className="flex-auto min-h-[10rem] w-full">
        <div className="ml-2">
          <Tooltip
            tooltip="Die Diagramme unten zeigen alle Confusion-Feedbacks der Teilnehmenden von Beginn bis Ende der Klicker-Session. Die Werte werden normalisiert auf dem Intervall [-1,1] dargestellt und auf 0 gesetzt, sollten in einem Zeitabschnitt keine Werte vorhanden sein. Die exakte Anzahl Feedbacks kann durch Hovering der Maus über einem Datenpunkt ausgelesen werden."
            className={{
              tooltip: 'max-w-[20%] md:max-w-[30%] text-sm z-10',
            }}
            withIndicator={false}
          >
            <FontAwesomeIcon
              icon={faQuestion}
              className="w-3 h-3 p-1 mt-1 text-white border border-white border-solid rounded-full bg-primary-60"
            />
          </Tooltip>
        </div>

        <ResponsiveContainer className="w-full mb-4" height={300}>
          <LineChart
            data={confusionValues}
            margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="6 6" />

            <XAxis dataKey="windowStart" />
            <YAxis domain={[-1 * peakValue, peakValue]} type="number" />

            <RechartsTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const difficulty = payload.find(
                    (item) => item.name === 'difficulty'
                  )
                  const speed = payload.find((item) => item.name === 'speed')
                  return (
                    <div className="p-2 text-gray-600 bg-white border border-gray-400 border-solid rounded">
                      <div className="font-bold">
                        {payload[0].payload.windowStart}
                      </div>
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

            <Line
              dataKey="speed"
              stroke="#8884d8"
              strokeOpacity={0.7}
              strokeWidth={2}
              type="monotone"
            />
            <Line
              dataKey="difficulty"
              stroke="#82ca9d"
              strokeOpacity={0.7}
              strokeWidth={2}
              type="monotone"
            />

            <ReferenceArea fill="green" fillOpacity={0.05} y1={-0.7} y2={0.7} />
            <ReferenceArea
              fill="orange"
              fillOpacity={0.05}
              y1={-0.7}
              y2={-1.4}
            />
            <ReferenceArea fill="orange" fillOpacity={0.05} y1={0.7} y2={1.4} />
            <ReferenceArea fill="red" fillOpacity={0.05} y1={1.4} y2={2.0} />
            <ReferenceArea fill="red" fillOpacity={0.05} y1={-1.4} y2={-2.0} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-initial p-3 lg:w-1/2">
        <div className="mb-2 font-bold ">Graph Settings</div>

        <Formik
          initialValues={{
            xInterval: xIntervalDefault,
            windowLength: runningWindowDefault,
          }}
          isInitialValid={true}
          validationSchema={confusionGraphSchema}
          onSubmit={() => undefined}
        >
          {({ values, setFieldValue, errors }) => {
            return (
              <Form className="flex flex-col">
                <div>
                  <FormikTextField
                    value={String(values.xInterval)}
                    onChange={(newValue: string) => {
                      const interval = Number(newValue.replace(/[^0-9]/g, ''))
                      setFieldValue('xInterval', interval)
                      if (interval >= 60) {
                        setXInterval(interval)
                      }
                    }}
                    label="Timesteps X-Axis"
                    tooltip="In diesem Feld kann die Schrittgrösse auf der x-Achse in Sekunden für die Diagramme eingegeben werden. Der Minimalwert ist 60 Sekunden, der Default-Wert 120 Sekunden."
                    className={{
                      root: !errors.xInterval ? 'mb-1' : '',
                      label: 'font-normal',
                      input: errors.xInterval
                        ? 'border-red-500 bg-red-100'
                        : '',
                    }}
                    placeholder="min. 60s"
                  />
                  {errors.xInterval && (
                    <div className="float-right text-sm text-red-600 mb-1.5">
                      {errors.xInterval}
                    </div>
                  )}
                </div>
                <div>
                  <FormikTextField
                    value={String(values.windowLength)}
                    onChange={(newValue: string) => {
                      const window = Number(newValue.replace(/[^0-9]/g, ''))
                      setFieldValue('windowLength', window)
                      if (window >= 1) {
                        setRunningWindow(window)
                      }
                    }}
                    label="Window Length"
                    tooltip="In diesem Feld kann ein eigener Faktor (multipliziert mit der Schrittweite auf der x-Achse) für die Grösse des Running Window zur Durchschnittsberechnung festgelegt werden. Der kleinstmögliche Faktor ist 1, der Default-Wert 3."
                    className={{
                      root: !errors.windowLength ? 'mb-1' : '',
                      label: 'font-normal',
                      input: errors.windowLength
                        ? 'border-red-500 bg-red-100'
                        : '',
                    }}
                    placeholder="min. 1"
                  />
                  {errors.windowLength && (
                    <div className="float-right text-sm text-red-600 mb-1.5">
                      {errors.windowLength}
                    </div>
                  )}
                </div>
              </Form>
            )
          }}
        </Formik>

        <div className="mt-4">Displayed interval: {xDataInterval} seconds</div>
        <div>Displayed running window: {runningAvgFactor} times interval</div>
      </div>
    </div>
  )
}

export default EvaluationConfusion
