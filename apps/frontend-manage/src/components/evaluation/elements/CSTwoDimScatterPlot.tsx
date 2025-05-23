import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import {
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
          type="number"
          dataKey="y"
          domain={[yLower, yUpper]}
          label={{
            value: yCriterionObj?.name,
            angle: -90,
            position: 'left',
            offset: -10,
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
          content={({ payload }) => {
            if (!payload?.[0]?.payload) return null
            const data = payload[0].payload

            return (
              <div className="rounded-md border-2 border-black bg-white p-2">
                <p className="font-bold">{data.itemLabel}</p>
                <p>{`${data.xCriterionName}: ${getLabelForValue(data.x, xCriterionObj, xLower, xUpper)}`}</p>
                <p>{`${data.yCriterionName}: ${getLabelForValue(data.y, yCriterionObj, yLower, yUpper)}`}</p>
              </div>
            )
          }}
        />
        {selectedCases.map((caseId) => {
          const caseIx = cases.findIndex((c) => c.id === caseId)

          return (
            <Scatter
              key={caseId}
              name={cases[caseIx]?.name}
              data={scatterData[caseId]}
              fill={CHART_COLORS[caseIx % 12]}
              shape={(props: any) => (
                <circle cx={props.cx} cy={props.cy} r={6} fill={props.fill} />
              )}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="itemLabel"
                position="top"
                offset={8}
                className={textSize.textLg}
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
          }}
          className={textSize.textLg}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default CSTwoDimScatterPlot
