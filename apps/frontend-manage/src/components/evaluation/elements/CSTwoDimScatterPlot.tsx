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

function CSTwoDimScatterPlot({
  scatterData,
  selectedCases,
  cases,
  criteria,
  textSize,
  xCriterion,
  yCriterion,
  xLower,
  xUpper,
  yLower,
  yUpper,
}: {
  scatterData: CaseStudyScatterPlotData
  selectedCases: string[]
  cases: CaseStudyElementResultCaseInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  textSize: TextSizeType
  xCriterion: string
  yCriterion: string
  xLower: number
  xUpper: number
  yLower: number
  yUpper: number
}) {
  // get the criteria objects for X and Y axes
  const xCriterionObj = criteria.find((c) => c.id === xCriterion)
  const yCriterionObj = criteria.find((c) => c.id === yCriterion)

  // state for hover to show error bars
  const [hoveredPoint, setHoveredPoint] = useState<{
    caseId: string
    itemLabel: string
    x: number
    y: number
  } | null>(null)

  // check if labels exist for the criteria
  const xHasLabels = !!(
    xCriterionObj?.labels?.min && xCriterionObj?.labels?.max
  )
  const yHasLabels = !!(
    yCriterionObj?.labels?.min && yCriterionObj?.labels?.max
  )

  // for step / likert criteria, set the tick values at the beginning, middle and end of the interval
  const xTickValues = xHasLabels
    ? xCriterionObj?.labels?.mid
      ? [xLower, (xLower + xUpper) / 2, xUpper]
      : [xLower, xUpper]
    : undefined

  const yTickValues = yHasLabels
    ? yCriterionObj?.labels?.mid
      ? [yLower, (yLower + yUpper) / 2, yUpper]
      : [yLower, yUpper]
    : undefined

  return (
    <ResponsiveContainer width="99%" height="99%">
      <ScatterChart
        margin={{
          top: 20,
          right: 20,
          bottom: 40,
          left: 20,
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
            offset: 15,
            className: textSize.textXl,
            style: { textAnchor: 'middle' },
          }}
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
          dataKey="y"
          domain={[yLower, yUpper]}
          label={{
            value: yCriterionObj?.name,
            angle: -90,
            position: 'left',
            offset: -7,
            className: textSize.textXl,
            style: { textAnchor: 'middle' },
          }}
          tick={(props) => {
            const { x, y, payload } = props

            if (!yHasLabels)
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={0}
                    y={5}
                    dx={-3}
                    textAnchor="end"
                    className={textSize.textLg}
                  >
                    {payload.value}
                  </text>
                </g>
              )

            if (Math.abs(payload.value - yLower) < 0.1) {
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={-20}
                    y={10}
                    textAnchor="start"
                    transform="rotate(-90, -20, 0)"
                    className={textSize.textLg}
                  >
                    {yCriterionObj?.labels?.min}
                  </text>
                </g>
              )
            } else if (Math.abs(payload.value - yUpper) < 0.1) {
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={-20}
                    y={10}
                    textAnchor="end"
                    transform="rotate(-90, -20, 0)"
                    className={textSize.textLg}
                  >
                    {yCriterionObj?.labels?.max}
                  </text>
                </g>
              )
            } else if (
              Math.abs(payload.value - (yLower + yUpper) / 2) < 0.1 &&
              yCriterionObj?.labels?.mid
            ) {
              return (
                <g transform={`translate(${x},${y})`}>
                  <text
                    x={-20}
                    y={10}
                    textAnchor="middle"
                    transform="rotate(-90, -20, 0)"
                    className={textSize.textLg}
                  >
                    {yCriterionObj?.labels?.mid}
                  </text>
                </g>
              )
            }

            return <></>
          }}
          ticks={yTickValues}
          tickLine={true}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          animationDuration={0} // Disable tooltip animation - appear instantly
          content={({ payload }) => {
            // use hovered point data instead of payload[0] to ensure correct data display
            if (!hoveredPoint) return null

            // find the correct data point from the payload that matches our hovered point
            const selectedDataPoint = payload?.find(
              (item) =>
                item.payload?.itemLabel === hoveredPoint.itemLabel &&
                item.payload?.x === hoveredPoint.x &&
                item.payload?.y === hoveredPoint.y
            )?.payload

            if (!selectedDataPoint) return null

            return (
              <div className="rounded-md border-2 border-black bg-white p-2">
                <p className="font-bold">{selectedDataPoint.itemLabel}</p>
                <p>{`${selectedDataPoint.xCriterionName}: ${getLabelForValue(selectedDataPoint.x, xCriterionObj, xLower, xUpper)} ${typeof selectedDataPoint.sigmaX !== 'undefined' ? `(± ${selectedDataPoint.sigmaX.toFixed(2)})` : ''}`}</p>
                <p>{`${selectedDataPoint.yCriterionName}: ${getLabelForValue(selectedDataPoint.y, yCriterionObj, yLower, yUpper)} ${typeof selectedDataPoint.sigmaY !== 'undefined' ? `(± ${selectedDataPoint.sigmaY.toFixed(2)})` : ''}`}</p>
              </div>
            )
          }}
        />

        {/* render all scatter points with conditional error bars */}
        {selectedCases.map((caseId) => {
          const caseIx = cases.findIndex((c) => c.id === caseId)

          return (
            <Scatter
              key={caseId}
              name={cases[caseIx]?.name}
              data={scatterData[caseId]}
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
                    {/* invisible hover area to trigger tooltip and error bars */}
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
                          y: props.payload.y,
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
                  // hide label if this point is currently hovered (tooltip is shown instead)
                  const isHovered =
                    hoveredPoint?.caseId === caseId &&
                    hoveredPoint?.itemLabel === props.payload?.itemLabel

                  if (isHovered) return null

                  return (
                    <text
                      x={props.x + 5}
                      y={props.y + 32}
                      textAnchor="middle"
                      fill="gray"
                      className={twMerge(
                        textSize.textLg,
                        'pointer-events-none',
                        hoveredPoint?.caseId === caseId &&
                          hoveredPoint?.itemLabel === props.value &&
                          'hidden'
                      )}
                    >
                      {props.value}
                    </text>
                  )
                }}
              />

              {/* show error bars only for hovered point */}
              {hoveredPoint?.caseId === caseId && (
                <>
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
                  <ErrorBar
                    dataKey={(entry) =>
                      entry.itemLabel === hoveredPoint.itemLabel
                        ? entry.sigmaY
                        : 0
                    }
                    width={4}
                    strokeWidth={2}
                    stroke={CHART_COLORS[caseIx % 12]}
                    direction="y"
                    opacity={0.8}
                    style={{ pointerEvents: 'none' }}
                  />
                </>
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
          }}
          className={textSize.textLg}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default CSTwoDimScatterPlot
