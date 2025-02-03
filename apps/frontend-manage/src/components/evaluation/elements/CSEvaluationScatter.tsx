import { faArrowRightArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CaseStudyElementResultCaseInfo,
  CaseStudyElementResultCriterionInfo,
  CaseStudyElementResultItemInfo,
} from '@klicker-uzh/graphql/dist/ops'
import {
  CHART_COLORS,
  ChartType,
} from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  Checkbox,
  H3,
  SelectField,
  UserNotification,
} from '@uzh-bf/design-system'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@uzh-bf/design-system/dist/future'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
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
import { twMerge } from 'tailwind-merge'
import { ActivityEvaluationType } from '../ActivityEvaluation'
import { TextSizeType } from '../textSizes'
import { CSResultsEvaluationObject } from './CSEvaluation'
// import { CHART_COLORS } from '@klicker-uzh/shared-components/src/constants'

enum AggregationType {
  MEAN = 'mean',
  MEDIAN = 'median',
}

interface CSEvaluationScatterProps {
  evaluationId: number
  results: CSResultsEvaluationObject
  cases: CaseStudyElementResultCaseInfo[]
  items: CaseStudyElementResultItemInfo[]
  criteria: CaseStudyElementResultCriterionInfo[]
  textSize: TextSizeType
  chartType: ChartType
  showSolution: boolean
  type: ActivityEvaluationType
}

function CSEvaluationScatter({
  evaluationId,
  results,
  cases,
  items,
  criteria,
  textSize,
  chartType,
  showSolution,
  type,
}: CSEvaluationScatterProps) {
  const t = useTranslations()

  const [selectedCases, setSelectedCases] = useState<string[]>([cases[0].id])
  const [xCriterion, setXCriterion] = useState<string | null>(null)
  const [yCriterion, setYCriterion] = useState<string | null>(null)
  const [aggregationType, setAggregationType] = useState<AggregationType>(
    AggregationType.MEAN
  )

  // initialize axes based on criteria
  useEffect(() => {
    if (criteria.length > 0) {
      setXCriterion(String(criteria[0].id))
    }
    if (criteria.length > 1) {
      setYCriterion(String(criteria[1].id))
    } else {
      setYCriterion(null)
    }
  }, [criteria])

  // TODO: extract to separate component
  // compute data for scatter plot
  const { scatterData, xLower, xUpper, yLower, yUpper } = useMemo(() => {
    // if no cases are selected, return early
    if (
      selectedCases.length === 0 ||
      xCriterion === null ||
      (criteria.length > 1 && yCriterion === null)
    ) {
      return {
        scatterData: undefined,
        xLower: 0,
        xUpper: 0,
        yLower: 0,
        yUpper: 0,
      }
    }

    const data = selectedCases.reduce<{
      [caseId: string]: {
        itemLabel: string
        caseName: string
        xCriterionName: string
        yCriterionName: string
        x: number
        y: number | undefined
      }[]
    }>((caseAcc, caseId: string) => {
      const caseObject = cases.find((c) => c.id === caseId)

      caseAcc[caseId] = items.flatMap((item) => {
        const xCriterionObject = results[caseId][item.id][xCriterion]
        const yCriterionObject = yCriterion
          ? results[caseId][item.id][yCriterion]
          : undefined

        const xValue = xCriterionObject?.statistics?.[aggregationType]
        const yValue = yCriterionObject?.statistics?.[aggregationType]

        if (
          typeof xValue === 'undefined' ||
          (yCriterion && typeof yValue === 'undefined')
        ) {
          return []
        }

        return {
          itemLabel: item.name,
          caseName: caseObject?.name ?? '',
          xCriterionName: xCriterionObject.name,
          yCriterionName: yCriterionObject?.name ?? '',
          x: xValue,
          y: yValue,
        }
      })

      return caseAcc
    }, {})

    return {
      scatterData: data,
      xLower: results[selectedCases[0]][items[0].id][xCriterion]?.min,
      xUpper: results[selectedCases[0]][items[0].id][xCriterion]?.max,
      yLower: yCriterion
        ? results[selectedCases[0]][items[0].id][yCriterion]?.min
        : 0,
      yUpper: yCriterion
        ? results[selectedCases[0]][items[0].id][yCriterion]?.max
        : 0,
    }
  }, [
    results,
    items,
    cases,
    criteria.length,
    selectedCases,
    xCriterion,
    yCriterion,
    aggregationType,
  ])

  return (
    <ResizablePanelGroup
      autoSaveId="evaluation-choices"
      key={`panel-group-${evaluationId}`}
      direction="horizontal"
    >
      <ResizablePanel defaultSize={70} minSize={50} className="px-4">
        {/* // TODO: extract to separate component?! */}
        {criteria.length === 1 && scatterData ? (
          <div>
            {/* // TODO */}
            1-DIM PLOT RECHARTS
          </div>
        ) : criteria.length > 1 && xCriterion && yCriterion && scatterData ? (
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
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={6}
                        fill={props.fill}
                      />
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
        ) : (
          <div className="flex h-full items-center justify-center">
            <UserNotification
              type="warning"
              message={t('manage.evaluation.caseStudySelectCasesCriteria')}
              className={{ root: 'py-auto text-lg' }}
            />
          </div>
        )}
      </ResizablePanel>
      <ResizableHandle withHandle className="w-0.5" />
      <ResizablePanel
        defaultSize={30}
        minSize={20}
        collapsible
        collapsedSize={0}
        className={twMerge('gap-2 border-l', textSize.text)}
      >
        {/* // TODO: extract to separate component */}
        <div className="flex flex-col gap-6 px-4 py-2">
          <div>
            <H3>{t('shared.generic.cases')}</H3>
            <div className="flex flex-col gap-1.5">
              {cases.map((caseItem, caseIx) => (
                <div
                  key={`settings-select-case-${caseItem.id}`}
                  className="flex flex-row gap-2"
                >
                  <Checkbox
                    checked={selectedCases.includes(caseItem.id)}
                    onCheck={() =>
                      setSelectedCases((prev) =>
                        prev.includes(caseItem.id)
                          ? prev.filter((id) => id !== caseItem.id)
                          : [...prev, caseItem.id]
                      )
                    }
                    style={{
                      root: {
                        backgroundColor: selectedCases.includes(caseItem.id)
                          ? CHART_COLORS[caseIx % 12]
                          : '',
                      },
                    }}
                    disabled={cases.length === 1}
                    className={{ root: 'text-white' }}
                  />
                  <div>{`${caseIx + 1}. ${caseItem.name}`}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            <H3 className={{ root: 'mb-0' }}>{t('shared.generic.settings')}</H3>
            <div className="flex w-full flex-row">
              <div className="w-full">
                <SelectField
                  required
                  label={t('manage.evaluation.criterionXAxis')}
                  items={criteria.map((criterion) => ({
                    value: String(criterion.id),
                    label: criterion.name,
                    disabled: criterion.id === yCriterion,
                  }))}
                  value={xCriterion ?? undefined}
                  onChange={(value) => setXCriterion(value)}
                  disabled={criteria.length === 1}
                  className={{
                    label: 'mt-0',
                    root: 'w-full',
                    select: { root: 'w-full', trigger: 'w-full' },
                  }}
                />
                {criteria.length > 1 ? (
                  <SelectField
                    required
                    label={t('manage.evaluation.criterionYAxis')}
                    items={criteria.map((criterion) => ({
                      value: String(criterion.id),
                      label: criterion.name,
                      disabled: criterion.id === xCriterion,
                    }))}
                    value={yCriterion ?? undefined}
                    onChange={(value) => setYCriterion(value)}
                    className={{
                      label: 'mt-0',
                      root: 'w-full',
                      select: { root: 'w-full', trigger: 'w-full' },
                    }}
                  />
                ) : null}
              </div>
              {criteria.length > 1 ? (
                <Button
                  basic
                  className={{
                    root: 'ml-2 mt-5 rotate-90 self-center rounded-full p-1',
                  }}
                  onClick={() => {
                    const temp = xCriterion
                    setXCriterion(yCriterion)
                    setYCriterion(temp)
                  }}
                >
                  <FontAwesomeIcon icon={faArrowRightArrowLeft} />
                </Button>
              ) : null}
            </div>
            <SelectField
              required
              label={t('manage.evaluation.aggregation')}
              items={[
                {
                  value: AggregationType.MEAN,
                  label: t('shared.generic.mean'),
                },
                {
                  value: AggregationType.MEDIAN,
                  label: t('shared.generic.median'),
                },
              ]}
              value={aggregationType}
              onChange={(value) => setAggregationType(value as AggregationType)}
              className={{
                root: 'mt-3 w-full',
                select: { root: 'w-full', trigger: 'w-full' },
              }}
            />
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export default CSEvaluationScatter
