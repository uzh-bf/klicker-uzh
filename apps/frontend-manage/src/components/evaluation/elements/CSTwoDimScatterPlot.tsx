import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
} from '@klicker-uzh/graphql/dist/ops'
import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'
import {
  CartesianGrid,
  LabelList,
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
          top: 40,
          right: 50,
          bottom: 35,
          left: 30,
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
          className={textSize.textLg}
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
                <p>{`${data.xCriterionName}: ${data.x}`}</p>
                <p>{`${data.yCriterionName}: ${data.y}`}</p>
              </div>
            )
          }}
        />
        {selectedCases.map((caseId) => {
          const caseIx = cases.findIndex((c) => c.id === caseId)

          return (
            <Scatter
              key={caseId}
              name={cases[caseIx].name}
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
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default CSTwoDimScatterPlot
