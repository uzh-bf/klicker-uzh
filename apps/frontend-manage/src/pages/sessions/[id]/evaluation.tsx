import { useQuery } from '@apollo/client'
import { faFont, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Block,
  GetSessionEvaluationDocument,
  GetSessionEvaluationQuery,
  InstanceResult,
  SessionBlockStatus,
  TabData,
} from '@klicker-uzh/graphql/dist/ops'
import Footer from '@klicker-uzh/shared-components/src/Footer'
import Leaderboard from '@klicker-uzh/shared-components/src/Leaderboard'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { ACTIVE_CHART_TYPES } from '@klicker-uzh/shared-components/src/constants'
import {
  Button,
  Select,
  Switch,
  UserNotification,
  useArrowNavigation,
} from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Rank1Img from 'public/img/rank1.svg'
import Rank2Img from 'public/img/rank2.svg'
import Rank3Img from 'public/img/rank3.svg'
import { useEffect, useMemo, useReducer, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import useEvaluationInitialization from '../../../components/hooks/useEvaluationInitialization'
import EvaluationConfusion from '../../../components/sessions/evaluation/EvaluationConfusion'
import EvaluationControlBar from '../../../components/sessions/evaluation/EvaluationControlBar'
import EvaluationFeedbacks from '../../../components/sessions/evaluation/EvaluationFeedbacks'
import QuestionEvaluation from '../../../components/sessions/evaluation/QuestionEvaluation'
import {
  TextSizes,
  sizeReducer,
} from '../../../components/sessions/evaluation/constants'

export type EvaluationTabData = TabData & { ix: number }
export type EvaluationBlock = Omit<Block, 'tabData'> & {
  tabData: EvaluationTabData[]
}

function Evaluation() {
  const router = useRouter()
  const t = useTranslations()

  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0)
  const [showLeaderboard, setLeaderboard] = useState<boolean>(false)
  const [showFeedbacks, setFeedbacks] = useState<boolean>(false)
  const [showConfusion, setConfusion] = useState<boolean>(false)
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState<number>(0)
  const [showSolution, setShowSolution] = useState<boolean>(false)
  const [chartType, setChartType] = useState<string>('')

  const [currentInstance, setCurrentInstance] = useState<InstanceResult>({
    blockIx: 0,
    id: '',
    instanceIx: 0,
    participants: 0,
    questionData: {
      id: 0,
      name: '',
      content: '',
      type: 'SC',
      options: { choices: [] },
    },
    results: {},
    statistics: {},
    status: SessionBlockStatus.Executed,
  })

  const [textSize, settextSize] = useReducer(sizeReducer, TextSizes['md'])

  const {
    data,
    loading,
    error,
  }: {
    data: GetSessionEvaluationQuery | undefined
    loading: any
    error?: any
  } = useQuery(GetSessionEvaluationDocument, {
    variables: {
      id: router.query.id as string,
    },
    pollInterval: 5000,
    skip: !router.query.id,
  })

  const {
    blocks: blockData,
    feedbacks,
    confusionFeedbacks,
    isGamificationEnabled,
    status,
  } = data?.sessionEvaluation || {
    blocks: [],
    feedbacks: [],
    confusionFeedbacks: [],
    isGamificationEnabled: false,
  }

  const instanceResults = useMemo(() => {
    return (
      data?.sessionEvaluation?.instanceResults?.map((result, ix) => ({
        ...result,
        ix,
      })) ?? []
    )
  }, [data])

  const { blocks } = useMemo(() => {
    if (!blockData) return { blocks: [] }

    return blockData.reduce(
      (acc: { ix: number; blocks: EvaluationBlock[] }, block: Block) => {
        const mappedBlock = {
          ...block,
          tabData: block.tabData?.map((instance, ix) => ({
            ...instance,
            ix: ix + acc.ix,
          })),
        }

        return {
          ix: acc.ix + (block.tabData?.length || 0),
          blocks: [...acc.blocks, mappedBlock],
        }
      },
      {
        ix: 0,
        blocks: [],
      }
    ) as { ix: number; blocks: EvaluationBlock[] }
  }, [blockData])

  useEvaluationInitialization({
    selectedInstanceIndex,
    instanceResults,
    chartType,
    questionIx: Number(router.query.questionIx ?? 0),
    setSelectedInstance,
    setCurrentInstance,
    setSelectedInstanceIndex,
    setChartType,
    setSelectedBlockIndex,
  })

  useArrowNavigation({
    onArrowLeft: () => {
      if (selectedInstanceIndex > 0 && selectedInstanceIndex !== -1) {
        setSelectedInstanceIndex(selectedInstanceIndex - 1)
      }
    },
    onArrowRight: () => {
      if (
        selectedInstanceIndex < instanceResults.length - 1 &&
        selectedInstanceIndex !== -1
      ) {
        setSelectedInstanceIndex(selectedInstanceIndex + 1)
      }
    },
  })

  useEffect(() => {
    if (router.query.leaderboard === 'true') {
      setLeaderboard(true)
      setConfusion(false)
      setFeedbacks(false)
      setSelectedBlockIndex(-1)
      setSelectedInstanceIndex(-1)
    }
  }, [router.query.leaderboard])

  if (error && !data) return <div>{t('shared.generic.systemError')}</div>
  if (loading || !data) return <Loader />

  if (!currentInstance.id && selectedInstanceIndex !== -1) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full">
        <UserNotification
          className={{
            root: 'max-w-[80%] lg:max-w-[60%] 2xl:max-w-[50%] text-lg',
          }}
          message={t('manage.evaluation.evaluationNotYetAvailable')}
        />
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>KlickerUZH - Evaluation</title>
        <meta
          name="description"
          content="KlickerUZH - Evaluation"
          charSet="utf-8"
        ></meta>
      </Head>
      <div className="z-20 flex-none h-11">
        <EvaluationControlBar
          blocks={blocks || []}
          selectedBlock={selectedBlockIndex}
          setSelectedBlock={setSelectedBlockIndex}
          setSelectedInstanceIndex={setSelectedInstanceIndex}
          selectedInstanceIndex={selectedInstanceIndex}
          instanceResults={instanceResults}
          setLeaderboard={setLeaderboard}
          setFeedbacks={setFeedbacks}
          setConfusion={setConfusion}
          showLeaderboard={showLeaderboard}
          showFeedbacks={showFeedbacks}
          showConfusion={showConfusion}
          status={status || ''}
          feedbacks={feedbacks || []}
          confusionFeedbacks={confusionFeedbacks || []}
          isGamificationEnabled={isGamificationEnabled}
        />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {currentInstance &&
          !showConfusion &&
          !showFeedbacks &&
          !showLeaderboard && (
            <QuestionEvaluation
              currentInstance={currentInstance}
              selectedInstance={selectedInstance}
              showSolution={showSolution}
              textSize={textSize}
              chartType={chartType}
              totalParticipants={currentInstance.participants}
            />
          )}

        {showLeaderboard && !showConfusion && !showFeedbacks && (
          <div className="overflow-y-auto">
            <div className="p-4 border-t">
              <div className="max-w-2xl mx-auto text-xl">
                {data.sessionLeaderboard &&
                data.sessionLeaderboard.length > 0 ? (
                  <Leaderboard
                    leaderboard={data.sessionLeaderboard ?? []}
                    podiumImgSrc={{
                      rank1: Rank1Img,
                      rank2: Rank2Img,
                      rank3: Rank3Img,
                    }}
                  />
                ) : (
                  <UserNotification
                    className={{ message: 'text-lg' }}
                    type="warning"
                    message={t('manage.evaluation.noSignedInStudents')}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {!showLeaderboard &&
          !showConfusion &&
          showFeedbacks &&
          data.sessionEvaluation && (
            <div className="overflow-y-auto print:overflow-y-visible">
              <div className="p-4">
                <div className="max-w-5xl mx-auto text-xl">
                  {feedbacks && feedbacks.length > 0 ? (
                    <EvaluationFeedbacks
                      feedbacks={feedbacks}
                      sessionName={data.sessionEvaluation.displayName}
                    />
                  ) : (
                    <UserNotification
                      className={{ message: 'text-lg' }}
                      type="warning"
                      message={t('manage.evaluation.noFeedbacksYet')}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

        {!showLeaderboard && showConfusion && !showFeedbacks && (
          <div className="overflow-y-auto">
            <div className="p-4 border-t">
              <div className="max-w-5xl mx-auto text-xl">
                {confusionFeedbacks && confusionFeedbacks.length > 0 ? (
                  <EvaluationConfusion confusionTS={confusionFeedbacks} />
                ) : (
                  <UserNotification
                    className={{ message: 'text-lg' }}
                    type="warning"
                    message={t('manage.evaluation.noConfusionFeedbacksYet')}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        className={twMerge(
          'flex-none h-14 z-20',
          (showFeedbacks || showConfusion || showLeaderboard) && 'h-18'
        )}
      >
        <Footer>
          {currentInstance &&
            !showFeedbacks &&
            !showConfusion &&
            !showLeaderboard && (
              <div className="flex flex-row items-center justify-between py-2.5 m-0">
                <div className="text-lg" data-cy="session-total-participants">
                  {t('manage.evaluation.totalParticipants', {
                    number: currentInstance.participants,
                  })}
                </div>
                <div className="flex flex-row items-center gap-7">
                  <div className="flex flex-row items-center gap-2 ml-2">
                    <Button
                      onClick={() => {
                        settextSize({ type: 'decrease' })
                      }}
                      disabled={textSize.size === 'sm'}
                      className={{
                        root: 'w-8 h-8 flex items-center justify-center',
                      }}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faMinus} />
                      </Button.Icon>
                    </Button>
                    <Button
                      onClick={() => {
                        settextSize({ type: 'increase' })
                      }}
                      disabled={textSize.size === 'xl'}
                      className={{
                        root: 'w-8 h-8 flex items-center justify-center',
                      }}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faPlus} />
                      </Button.Icon>
                    </Button>
                    <FontAwesomeIcon icon={faFont} size="lg" />
                    {t('manage.evaluation.fontSize')}
                  </div>
                  <Switch
                    checked={showSolution}
                    label={t('manage.evaluation.showSolution')}
                    onCheckedChange={(newValue) => setShowSolution(newValue)}
                  />
                  <Select
                    contentPosition="popper"
                    className={{
                      trigger: 'border-slate-400',
                    }}
                    items={ACTIVE_CHART_TYPES[
                      currentInstance.questionData.type
                    ].map((item) => {
                      return { label: t(item.label), value: item.value }
                    })}
                    value={chartType}
                    onChange={(newValue: string) => setChartType(newValue)}
                  />
                </div>
              </div>
            )}
        </Footer>
      </div>
    </>
  )
}

export async function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default Evaluation
