import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import { useState } from 'react'
import {
  CartesianGrid,
  ErrorBar,
  LabelList,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { twMerge } from 'tailwind-merge'
import { TextSizeType } from '../textSizes'
import { CaseStudyScatterPlotData } from './CSEvaluationScatter'
import getLabelForValue from './getLabelForValue'

function CSOneDimScatterPlot({
  scatterData,
  selectedCases,
  cases,
  criteria,
  textSize,
  xCriterion,
  xLower,
  xUpper,
}: {
  scatterData: CaseStudyScatterPlotData
  selectedCases: string[]
  cases: CaseStudyElementResultCaseInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  textSize: TextSizeType
  xCriterion: string
  xLower: number
  xUpper: number
}) {
  // state for hover to show error bars
  const [hoveredPoint, setHoveredPoint] = useState<{
    caseId: string
    itemLabel: string
    x: number
    y: number
  } | null>(null)

  // get the criterion object for the X axis
  const xCriterionObj = criteria.find((c) => c.id === xCriterion)

  // check if labels exist for the criterion
  const xHasLabels = !!(
    xCriterionObj?.labels?.min && xCriterionObj?.labels?.max
  )

  // for step / likert criteria, set the tick values at the beginning, middle and end of the interval
  const xTickValues = xHasLabels
    ? xCriterionObj?.labels?.mid
      ? [xLower, (xLower + xUpper) / 2, xUpper]
      : [xLower, xUpper]
    : undefined

  return (
    <ResponsiveContainer width="99%" height="99%">
      <ScatterChart
        margin={{
          top: 20,
          right: 50,
          bottom: 35,
          left: 30,
        }}
      >
        <CartesianGrid vertical={true} horizontal={false} />
        <XAxis
          allowDataOverflow
          type="number"
          dataKey="x"
          domain={[xLower, xUpper]}
          label={{
            value: xCriterionObj?.name,
            position: 'bottom',
            offset: 5,
          }}
          className={textSize.textLg}
          tick={(props) => {
            const { x, y, payload } = props

            if (!xHasLabels)
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={16}
                    textAnchor="middle"
                    className={textSize.textLg}
                  >
                    {payload.value}
                  </text>
                </g>
              )

            if (Math.abs(payload.value - xLower) < 0.1) {
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={16}
                    textAnchor="start"
                    className={textSize.textLg}
                  >
                    {xCriterionObj?.labels?.min}
                  </text>
                </g>
              )
            } else if (Math.abs(payload.value - xUpper) < 0.1) {
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={16}
                    textAnchor="end"
                    className={textSize.textLg}
                  >
                    {xCriterionObj?.labels?.max}
                  </text>
                </g>
              )
            } else if (
              Math.abs(payload.value - (xLower + xUpper) / 2) < 0.1 &&
              xCriterionObj?.labels?.mid
            ) {
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={0}
                    dy={16}
                    textAnchor="middle"
                    className={textSize.textLg}
                  >
                    {xCriterionObj?.labels?.mid}
                  </text>
                </g>
              )
            }

            return <></>
          }}
          ticks={xTickValues}
          tickLine={true}
        />
        <YAxis
          allowDataOverflow
          type="number"
          dataKey="caseId"
          domain={[
            -(0.1 * selectedCases.length),
            selectedCases.length - 1 + 0.1 * selectedCases.length,
          ]}
          ticks={selectedCases.map((_, index) => index)}
          tickFormatter={(tick) => cases[tick]?.name || ''}
          className={textSize.textLg}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          animationDuration={0}
          content={({ payload }) => {
            if (!hoveredPoint) return null

            // find the correct data point from the payload that matches our hovered point
            const selectedDataPoint = payload?.find(
              (item) =>
                item.payload?.itemLabel === hoveredPoint.itemLabel &&
                item.payload?.x === hoveredPoint.x &&
                item.payload?.caseId === hoveredPoint.y
            )?.payload

            if (!selectedDataPoint) return null

            return (
              <div className="rounded-md border-2 border-black bg-white p-2">
                <p className="font-bold">{selectedDataPoint.itemLabel}</p>
                <p>{`${selectedDataPoint.xCriterionName}: ${getLabelForValue(selectedDataPoint.x, xCriterionObj, xLower, xUpper)} ${typeof selectedDataPoint.sigmaX !== 'undefined' ? `(± ${selectedDataPoint.sigmaX.toFixed(2)})` : ''}`}</p>
              </div>
            )
          }}
        />
        {selectedCases.map((caseId, index) => {
          const caseIx = cases.findIndex((c) => c.id === caseId)

          const dataWithCaseIndex = scatterData[caseId].map((data) => ({
            ...data,
            caseId: index,
          }))

          return (
            <Scatter
              key={caseId}
              name={cases[caseIx]?.name}
              data={dataWithCaseIndex}
              fill={CHART_COLORS[caseIx % 12]}
              shape={(props: any) => {
                const isHovered =
                  hoveredPoint?.caseId === caseId &&
                  hoveredPoint?.itemLabel === props.payload.itemLabel

                return (
                  <g>
                    {/* visible circle */}
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={6}
                      fill={props.fill}
                      opacity={isHovered ? 1 : 0.8}
                      stroke={isHovered ? '#000' : 'none'}
                      strokeWidth={isHovered ? 2 : 0}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* invisible hover area */}
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: Pointer hover only drives the chart tooltip; the point is not an activation target. */}
                    <circle
                      cx={props.cx}
                      cy={props.cy}
                      r={12}
                      fill="transparent"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          caseId,
                          itemLabel: props.payload.itemLabel,
                          x: props.payload.x,
                          y: props.payload.caseId,
                        })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                      style={{ cursor: 'pointer' }}
                    />
                  </g>
                )
              }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="itemLabel"
                className={textSize.textLg}
                content={(props: any) => {
                  const isHovered =
                    hoveredPoint?.caseId === caseId &&
                    hoveredPoint?.itemLabel === props.payload?.itemLabel

                  if (isHovered) return null

                  return (
                    <text
                      x={props.x + 5}
                      y={props.y + (index === 0 ? -14 : 26)}
                      textAnchor="middle"
                      fill="gray"
                      className={twMerge(
                        textSize.textLg,
                        'pointer-events-none'
                      )}
                    >
                      {props.value}
                    </text>
                  )
                }}
              />

              {hoveredPoint?.caseId === caseId && (
                <ErrorBar
                  dataKey={(entry) =>
                    entry.itemLabel === hoveredPoint.itemLabel
                      ? entry.sigmaX
                      : 0
                  }
                  width={4}
                  strokeWidth={2}
                  stroke={CHART_COLORS[caseIx % 12]}
                  direction="x"
                  opacity={0.8}
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </Scatter>
          )
        })}
        <Legend
          align="right"
          verticalAlign="top"
          wrapperStyle={{
            fontSize: '1.125rem',
            lineHeight: '1.75rem',
            paddingTop: '10px',
            paddingBottom: twMerge(selectedCases.length > 1 && '35px'),
          }}
          className={textSize.textLg}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default CSOneDimScatterPlot
