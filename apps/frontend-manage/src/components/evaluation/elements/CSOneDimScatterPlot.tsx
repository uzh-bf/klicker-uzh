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
    caseIndex: number
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
        <CartesianGrid />
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
          content={({ payload }) => {
            if (!payload?.[0]?.payload) return null
            const data = payload[0].payload

            return (
              <div className="rounded-md border-2 border-black bg-white p-2">
                <p className="font-bold">{data.itemLabel}</p>
                <p>{`${data.xCriterionName}: ${getLabelForValue(data.x, xCriterionObj, xLower, xUpper)} ${typeof data.sigmaX !== 'undefined' ? `(± ${data.sigmaX.toFixed(2)})` : ''}`}</p>
              </div>
            )
          }}
        />
        {selectedCases.map((caseId, index) => {
          const caseIx = cases.findIndex((c) => c.id === caseId)

          // do not show the currently hovered point in the scatter plot
          const filteredData = hoveredPoint
            ? scatterData[caseId]
                .map((data) => ({ ...data, caseId: index }))
                .filter(
                  (point) =>
                    !(
                      hoveredPoint.caseId === caseId &&
                      hoveredPoint.itemLabel === point.itemLabel
                    )
                )
            : scatterData[caseId].map((data) => ({ ...data, caseId: index }))

          return (
            <Scatter
              key={caseId}
              name={cases[caseIx]?.name}
              data={filteredData}
              fill={CHART_COLORS[caseIx % 12]}
              shape={(props: any) => (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={6}
                  fill={props.fill}
                  onMouseEnter={() =>
                    setHoveredPoint({
                      caseId,
                      itemLabel: props.payload.itemLabel,
                      x: props.payload.x,
                      caseIndex: index,
                    })
                  }
                  onMouseLeave={() => setHoveredPoint(null)}
                  style={{ cursor: 'pointer' }}
                />
              )}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="itemLabel"
                position={index === 0 ? 'top' : 'bottom'}
                offset={8}
                className={textSize.textLg}
              />
            </Scatter>
          )
        })}

        {/* render the hovered point with error bars */}
        {hoveredPoint &&
          selectedCases.map((caseId) => {
            if (caseId !== hoveredPoint.caseId) return null
            const caseIx = cases.findIndex((c) => c.id === caseId)
            const hoveredPointData = scatterData[caseId]
              .filter((point) => point.itemLabel === hoveredPoint.itemLabel)
              .map((data) => ({
                ...data,
                caseId: hoveredPoint.caseIndex,
              }))

            if (hoveredPointData.length === 0) return null

            return (
              <Scatter
                legendType="none"
                key={`${caseId}-hovered`}
                data={hoveredPointData}
                fill={CHART_COLORS[caseIx % 12]}
                shape={(props: any) => (
                  <circle
                    cx={props.cx}
                    cy={props.cy}
                    r={8}
                    fill={props.fill}
                    opacity={1}
                    stroke="#000"
                    strokeWidth={1}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: 'pointer' }}
                  />
                )}
                isAnimationActive={false}
              >
                <ErrorBar
                  dataKey="sigmaX"
                  width={4}
                  strokeWidth={2}
                  opacity={0.8}
                  stroke={CHART_COLORS[caseIx % 12]}
                  direction="x"
                />
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
