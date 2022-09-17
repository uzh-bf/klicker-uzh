import { useRouter } from 'next/router'
import React, { useState } from 'react'

import Chart from '../../../components/evaluation/Chart'
// import FeedbackTableChart from '../../../components/interaction/feedbacks/FeedbackTableChart'
import { useQuery } from '@apollo/client'
import { GetEvaluationSessionDocument } from '@klicker-uzh/graphql/dist/ops'
import EvaluationLayout from '../../../components/EvaluationLayout'
import { BlockList } from 'net'

// export function reduceActiveInstances(
//   allInstances: any[],
//   { instances, status },
//   index: number
// ): any[] {
//   // inject the status of the block into the instance object
//   const instancesWithBlockStatus = instances.map((instance): any => ({
//     ...instance,
//     blockNumber: index + 1,
//     blockStatus: status,
//   }))
//   // reduce to a list of all instances, no matter the block status
//   // reduce array of arrays [[], [], []] to [...]
//   return [...allInstances, ...instancesWithBlockStatus]
// }

// export function mapActiveInstance(activeInstance: any): any {
//   // map the array of all instances with the custom mapper
//   if (QUESTION_GROUPS.CHOICES.includes(activeInstance.question.type)) {
//     return {
//       ...activeInstance,
//       results: {
//         data: activeInstance.question.versions[activeInstance.version].options[
//           activeInstance.question.type
//         ].choices.map((choice, index): any => ({
//           correct: choice.correct,
//           count: _get(activeInstance, `results.CHOICES[${index}]`) || 0,
//           value: choice.name,
//         })),
//         totalResponses: _get(activeInstance, 'results.totalParticipants') || 0,
//       },
//     }
//   }

//   if (QUESTION_GROUPS.FREE.includes(activeInstance.question.type)) {
//     let data = _get(activeInstance, 'results.FREE') || []

//     // values in FREE_RANGE questions need to be numerical
//     if (activeInstance.question.type === QUESTION_TYPES.FREE_RANGE) {
//       data = data.map(({ value, ...rest }): any => ({
//         ...rest,
//         value: +value,
//       }))
//     }

//     return {
//       ...activeInstance,
//       results: {
//         data,
//         totalResponses: _get(activeInstance, 'results.totalParticipants') || 0,
//       },
//     }
//   }

//   return activeInstance
// }

// export function extractInstancesFromSession(session): any {
//   const blocks = _get(session, 'blocks')

//   if (!blocks) {
//     console.error('no blocks', session)
//     return {
//       activeInstances: [],
//       instanceSummary: [],
//       sessionStatus: _get(session, 'status'),
//     }
//   }

//   // reduce question blocks to the active instances
//   const activeInstances = blocks
//     // filter out future blocks as we don't want to display them too early
//     .filter((block): boolean => block.status !== 'PLANNED')
//     .reduce(reduceActiveInstances, [])
//     .map(mapActiveInstance)

//   return {
//     activeInstances,
//     // generate an instance summary for easy display of "tabs"
//     instanceSummary: activeInstances.map(
//       ({ blockStatus, blockNumber, solution, question, results }): any => ({
//         blockNumber,
//         blockStatus,
//         hasSolution: !!solution,
//         title: question.title,
//         totalResponses: _get(results, 'totalResponses') || 0,
//       })
//     ),
//     sessionStatus: _get(session, 'status'),
//   }
// }

function Evaluation(): React.ReactElement {
  const router = useRouter()

  const isPublic = !!router.query.public
  const sessionId: string = router.query.id as string

  const [showFeedback, setShowFeedback] = useState(false)
  const [showConfusionTS, setShowConfusionTS] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [activeInstance, setActiveInstance] = useState(0)
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false)
  const [isConfusionVisible, setIsConfusionVisible] = useState(false)

  const { data, loading } = useQuery(GetEvaluationSessionDocument, {
    variables: { id: sessionId },
    skip: !router.query.id,
  })

  if (loading || !data) {
    return <div>loading</div>
  }

  if (activeTab < data.evaluationSession?.blocks.length) {
    const { TODO } = data.evaluationSession?.blocks[activeTab].instances[activeInstance]
    setIsFeedbackVisible(false)
    setIsConfusionVisible(false)
  } else if (activeTab === data.evaluationSession?.blocks.length) {
    setIsFeedbackVisible(true)
    setIsConfusionVisible(false)
  } else {
    setIsFeedbackVisible(false)
    setIsConfusionVisible(true)
  }


  const layoutProps = {
    activeInstances,
    activeInstance: activeInstanceIndex,
    activeVisualization: question ? activeVisualizations[question.type] : null,
    data: results?.data,
    description: question?.versions[version].content,
    instanceSummary,
    onChangeActiveInstance: setActiveInstanceIndex,
    onChangeVisualizationType: (questionType, visualizationType): void =>
      setActiveVisualizations({
        ...activeVisualizations,
        [questionType]: visualizationType,
      }),
    setShowSolution,
    options,
    pageTitle: 'Evaluation',
    sessionId,
    showGraph,
    files: question?.versions[version].files,
    showSolution,
    statistics: activeInstance.statistics,
    title: question?.title,
    totalResponses: results?.totalResponses,
    type: question?.type,
    feedbacks,
    onChangeShowFeedback: setShowFeedback,
    showFeedback,
    confusionTS,
    onChangeShowConfusionTS: setShowConfusionTS,
    showConfusionTS,
    showQuestionLayout: !(showFeedback || showConfusionTS),
    sessionStatus,
  }

  return (
    <EvaluationLayout {...layoutProps}>
      {!(showFeedback || showConfusionTS) && question && (
        <Chart
          activeVisualization={activeVisualizations[question.type]}
          data={results.data}
          handleShowGraph={(): void => setShowGraph(true)}
          instanceId={activeInstance.id}
          isPublic={isPublic}
          numBins={bins}
          questionType={question.type}
          restrictions={options?.FREE_RANGE && options?.FREE_RANGE.restrictions}
          sessionId={sessionId}
          sessionStatus={sessionStatus}
          showGraph={showGraph}
          showSolution={showSolution}
          statistics={activeInstance.statistics}
          totalResponses={results.totalResponses}
        />
      )}
      {/* // TODO: readd evaluation view for feedbacks
                  {sessionStatus === SESSION_STATUS.COMPLETED && showFeedback && (
                    <div className="h-full overflow-auto !print:overflow-visible">
                      <FeedbackTableChart feedbacks={feedbacks} />
                    </div>
                  )} */}
      {/* // TOOD: readd evaluation view for confusion
                   {sessionStatus === SESSION_STATUS.COMPLETED &&
                    showConfusionTS && (
                      <EvaluationConfusion confusionTS={confusionTS} />
                    )} */}
    </EvaluationLayout>
  )
}

export default Evaluation
