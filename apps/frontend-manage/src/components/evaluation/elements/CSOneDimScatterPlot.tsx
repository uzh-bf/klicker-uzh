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
import { twMerge } from 'tailwind-merge'
import { TextSizeType } from '../textSizes'
import { CaseStudyScatterPlotData } from './CSEvaluationScatter'

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
  return (
    <ResponsiveContainer width="99%" height="50%">
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
          dataKey="caseId"
          domain={[0, selectedCases.length - 1]}
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
                <p>{`${data.xCriterionName}: ${data.x.toFixed(2)}`}</p>
              </div>
            )
          }}
        />
        {selectedCases.map((caseId, index) => {
          const caseIx = cases.findIndex((c) => c.id === caseId)

          return (
            <Scatter
              key={caseId}
              name={cases[caseIx]?.name}
              data={scatterData[caseId].map((data) => ({
                ...data,
                x: data.x,
                caseId: index,
              }))}
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
            paddingBottom: twMerge(selectedCases.length > 1 && '35px'),
          }}
          className={textSize.textLg}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}

export default CSOneDimScatterPlot
