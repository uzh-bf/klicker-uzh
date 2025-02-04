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
  return (
    <ResponsiveContainer width="99%" height="99%">
      <ScatterChart
        margin={{
          top: 20,
          right: 10,
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
            value: criteria.find((c) => c.id === xCriterion)?.name,
            position: 'bottom',
            offset: 5,
          }}
          className={textSize.textXl}
        />
        <YAxis
          type="number"
          dataKey="y"
          domain={[yLower, yUpper]}
          label={{
            value: criteria.find((c) => c.id === yCriterion)?.name,
            angle: -90,
            position: 'left',
            offset: 0,
          }}
          className={textSize.textXl}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ payload }) => {
            if (!payload?.[0]?.payload) return null
            const data = payload[0].payload

            return (
              <div className="rounded-md border-2 border-black bg-white p-2">
                <p className="font-bold">{data.itemLabel}</p>
                <p>{`${data.xCriterionName}: ${data.x.toFixed(2)}`}</p>
                <p>{`${data.yCriterionName}: ${data.y.toFixed(2)}`}</p>
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
