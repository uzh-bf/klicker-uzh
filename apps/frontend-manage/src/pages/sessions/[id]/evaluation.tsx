import { useQuery } from '@apollo/client'
import Footer from '@components/common/Footer'
import Chart from '@components/evaluation/Chart'
import { extractQuestions } from '@components/evaluation/utils'
import { faCheck, faSync } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetSessionEvaluationDocument } from '@klicker-uzh/graphql/dist/ops'
import Markdown from '@klicker-uzh/markdown'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { Prose, Select, Switch } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { groupBy } from 'ramda'
import { useMemo, useState } from 'react'
import {
  ACTIVE_CHART_TYPES,
  CHART_COLORS,
} from 'shared-components/src/constants'
import { twMerge } from 'tailwind-merge'

interface Tab {
  status: 'EXECUTED' | 'ACTIVE'
  title: string
  value: string
}

const INSTANCE_STATUS_ICON = {
  EXECUTED: faCheck,
  ACTIVE: faSync,
}

function Evaluation() {
  const router = useRouter()

  // TODO: replace with corresponding database field and query
  const [showSolution, setShowSolution] = useState(false)
  const [activeBlock, setActiveBlock] = useState(0)
  const [activeInstance, setActiveInstance] = useState(0)
  const [chartType, setChartType] = useState('')

  const { data, loading, error } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 5000,
    skip: !router.query.id,
  })

  const { groupedTabs } = useMemo(() => {
    if (!data) return { tabs: [] }

    const tabs = data.sessionEvaluation?.instanceResults?.map(
      (instance, index) => ({
        id: instance.id,
        blockIx: instance.blockIx,
        instanceIx: instance.instanceIx,
        value: 'tab' + index,
        title: instance.questionData.name,
        status: instance.status,
        label: instance.questionData.name,
      })
    )

    if (!tabs) return { tabs: [] }

    const groupedTabs = Object.entries(
      groupBy((tab) => tab.blockIx.toString(), tabs)
    )

    return { tabs, groupedTabs }
  }, [data])

  const questions = useMemo(() => {
    if (!data) return []
    return extractQuestions(data)
  }, [data])

  if (error) return <div>An error occurred, please try again later.</div>
  if (loading || !data) return <div>Loading...</div>

  const currentQuestion = questions?.find(
    (question) =>
      question.blockIx == activeBlock && question.instanceIx == activeInstance
  )

  return (
    <TabsPrimitive.Root
      value={`tab-${activeBlock}`}
      className="flex flex-col h-full p-1"
    >
      <TabsPrimitive.List
        className={twMerge('flex-initial flex flex-col md:flex-row')}
      >
        {groupedTabs?.map(([blockIx, items], groupIx) => (
          <TabsPrimitive.Trigger
            key={`tab-trigger-${blockIx}`}
            value={'tab' + blockIx}
            className={twMerge(
              'px-2 py-1 border-r first:border-l border-b-2 border-b-uzh-grey-100 rdx-state-active:border-b-uzh-blue-100 hover:border-b-uzh-blue-60 hover:text-uzh-blue-100 text-slate-700 rdx-state-active:text-slate-900'
            )}
            onClick={() => {
              setActiveBlock(Number(blockIx))
              setActiveInstance(0)
            }}
          >
            <div className="flex flex-row items-center gap-1 text-sm text-left">
              <div>
                <FontAwesomeIcon
                  size="xs"
                  icon={INSTANCE_STATUS_ICON[items[0].status]}
                />
              </div>
              <div>Block {Number(blockIx) + 1}</div>
            </div>
            <Select
              items={items.map((item) => ({
                value: String(item.instanceIx),
                label: item.label,
              }))}
              onChange={(newIx) => {
                setActiveBlock(Number(blockIx))
                setActiveInstance(Number(newIx))
              }}
            />
          </TabsPrimitive.Trigger>
        ))}

        {currentQuestion && (
          <Select
            items={ACTIVE_CHART_TYPES[currentQuestion.type]}
            onChange={(newValue) => {
              setChartType(newValue)
            }}
          ></Select>
        )}
      </TabsPrimitive.List>

      {currentQuestion && (
        <div>
          <Prose className="flex-initial prose-xl border-b prose-p:m-0 max-w-none">
            <Markdown
              className="flex flex-row content-between p-2"
              content={currentQuestion.content}
            />
          </Prose>

          <div className="flex flex-col flex-1 md:flex-row">
            <div className="z-10 flex-1 order-2 md:order-1">
              <Chart
                chartType={chartType}
                data={currentQuestion}
                showSolution={showSolution}
              />
            </div>
            <div className="flex-initial order-1 w-64 p-4 border-l md:order-2">
              <div className="flex flex-col gap-2">
                {(currentQuestion.type === 'SC' ||
                  currentQuestion.type === 'MC' ||
                  currentQuestion.type === 'KPRIM') &&
                  currentQuestion.answers.map((answer, innerIndex) => (
                    <div
                      key={currentQuestion.answers[innerIndex].value}
                      className="flex flex-row"
                    >
                      <div
                        style={{
                          backgroundColor:
                            answer.correct && showSolution
                              ? '#00de0d'
                              : CHART_COLORS[innerIndex % 12],
                        }}
                        className={twMerge(
                          'mr-2 text-center rounded-md w-7 h-7 text-white font-bold',
                          answer.correct && showSolution && 'text-black'
                        )}
                      >
                        {String.fromCharCode(65 + innerIndex)}
                      </div>
                      <Markdown
                        content={answer.value}
                        className="w-[calc(100%-3rem)]"
                      />
                    </div>
                  ))}

                {currentQuestion.type === 'NUMERICAL' && (
                  <div>
                    <div className="font-bold">Erlaubter Antwortbereich:</div>
                    <div>
                      [{currentQuestion.restrictions!.min ?? '-∞'},
                      {currentQuestion.restrictions!.max ?? '+∞'}]
                    </div>
                    {showSolution && currentQuestion.solutions!.solutionRanges && (
                      <div>
                        <div className="mt-2 font-bold">
                          Korrekte Lösungsbereiche:
                        </div>
                        {currentQuestion.solutions!.solutionRanges.map(
                          (range, innerIndex) => (
                            <div key={innerIndex}>
                              [{range.min ?? '-∞'},{range.max ?? '+∞'}]
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
                {currentQuestion.type === 'FREE_TEXT' &&
                  currentQuestion.solutions!.freeTextSolutions &&
                  showSolution && (
                    <div>
                      <div className="font-bold">Schlüsselwörter Lösung:</div>
                      <ul>
                        {currentQuestion.solutions!.freeTextSolutions.map(
                          (keyword, innerIndex) => (
                            <li key={innerIndex}>{`- ${keyword}`}</li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
              </div>
            </div>
          </div>
          <Footer>
            <div className="flex flex-row justify-between px-8 py-4 m-0">
              <div className="text-xl">
                Total Participants: {currentQuestion.participants}
              </div>
              <Switch
                id="showSolution"
                checked={showSolution}
                label="Show solution"
                onCheckedChange={(newValue) => setShowSolution(newValue)}
              ></Switch>
            </div>
          </Footer>
        </div>
      )}
    </TabsPrimitive.Root>
  )
}

export default Evaluation
