import React from 'react'
import _get from 'lodash/get'
import { defineMessages, useIntl } from 'react-intl'
import { useRouter } from 'next/router'

import { QUESTION_GROUPS, QUESTION_TYPES } from '../../constants'
import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import useLogging from '../../lib/useLogging'
import { Chart } from '../../components/evaluation'
import LoadSessionData from '../../components/sessions/LoadSessionData'
import ComputeActiveInstance from '../../components/sessions/ComputeActiveInstance'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Evaluation',
    id: 'evaluation.pageTitle',
  },
})

export function extractInstancesFromSession(session) {
  // reduce question blocks to the active instances
  const activeInstances = session.blocks
    // filter out future blocks as we don't want to display them too early
    .filter(block => block.status !== 'PLANNED')
    .reduce((allInstances, { instances, status }, index) => {
      // inject the status of the block into the instance object
      const instancesWithBlockStatus = instances.map(instance => ({
        ...instance,
        blockNumber: index + 1,
        blockStatus: status,
      }))
      // reduce to a list of all instances, no matter the block status
      // reduce array of arrays [[], [], []] to [...]
      return [...allInstances, ...instancesWithBlockStatus]
    }, [])
    .map(activeInstance => {
      // map the array of all instances with the custom mapper
      if (QUESTION_GROUPS.CHOICES.includes(activeInstance.question.type)) {
        return {
          ...activeInstance,
          results: {
            data: activeInstance.question.versions[activeInstance.version].options[
              activeInstance.question.type
            ].choices.map((choice, index) => ({
              correct: choice.correct,
              count: _get(activeInstance, `results.CHOICES[${index}]`) || 0,
              value: choice.name,
            })),
            totalResponses: _get(activeInstance, 'results.totalParticipants') || 0,
          },
        }
      }

      if (QUESTION_GROUPS.FREE.includes(activeInstance.question.type)) {
        let data = _get(activeInstance, 'results.FREE') || []

        // values in FREE_RANGE questions need to be numerical
        if (activeInstance.question.type === QUESTION_TYPES.FREE_RANGE) {
          data = data.map(({ value, ...rest }) => ({
            ...rest,
            value: +value,
          }))
        }

        return {
          ...activeInstance,
          results: {
            data,
            totalResponses: _get(activeInstance, 'results.totalParticipants') || 0,
          },
        }
      }

      return activeInstance
    })

  return {
    activeInstances,
    // generate an instance summary for easy display of "tabs"
    instanceSummary: activeInstances.map(({ blockStatus, blockNumber, solution, question, results }) => ({
      blockNumber,
      blockStatus,
      hasSolution: !!solution,
      title: question.title,
      totalResponses: _get(results, 'totalResponses') || 0,
    })),
    sessionStatus: session.status,
  }
}

function Evaluation(): React.ReactElement {
  useLogging()

  const intl = useIntl()
  const router = useRouter()

  const isPublic = !!router.query.public
  const sessionId: string = router.query.sessionId.toString()

  return (
    <LoadSessionData isPublic={isPublic} sessionId={sessionId}>
      {({ data, loading }): React.ReactElement => {
        if (loading || !data) {
          return null
        }

        const { activeInstances, sessionStatus, instanceSummary } = extractInstancesFromSession(data)

        return (
          <ComputeActiveInstance activeInstances={activeInstances} sessionStatus={sessionStatus}>
            {({
              activeInstance,
              activeInstanceIndex,
              activeVisualizations,
              showGraph,
              showSolution,
              setShowSolution,
              setActiveInstanceIndex,
              setActiveVisualizations,
              setShowGraph,
              bins,
            }): React.ReactElement => {
              const { results, question, version } = activeInstance
              const { description, options } = question.versions[version]

              const layoutProps = {
                activeInstances,
                activeInstance: activeInstanceIndex,
                activeVisualization: activeVisualizations[question.type],
                data: results.data,
                description,
                instanceSummary,
                onChangeActiveInstance: setActiveInstanceIndex,
                onChangeVisualizationType: (questionType, visualizationType) =>
                  setActiveVisualizations({
                    ...activeVisualizations,
                    [questionType]: visualizationType,
                  }),
                onToggleShowSolution: () => setShowSolution(!showSolution),
                options,
                pageTitle: intl.formatMessage(messages.pageTitle),
                sessionId,
                showGraph,
                showSolution,
                statistics: activeInstance.statistics,
                title: question.title,
                totalResponses: results.totalResponses,
                type: question.type,
              }

              return (
                <EvaluationLayout {...layoutProps}>
                  <Chart
                    activeVisualization={activeVisualizations[question.type]}
                    data={results.data}
                    handleShowGraph={() => setShowGraph(true)}
                    instanceId={activeInstance.id}
                    isPublic={isPublic}
                    numBins={bins}
                    questionType={question.type}
                    restrictions={options.FREE_RANGE && options.FREE_RANGE.restrictions}
                    sessionId={sessionId}
                    sessionStatus={sessionStatus}
                    showGraph={showGraph}
                    showSolution={showSolution}
                    statistics={activeInstance.statistics}
                    totalResponses={results.totalResponses}
                  />
                </EvaluationLayout>
              )
            }}
          </ComputeActiveInstance>
        )
      }}
    </LoadSessionData>
  )
}

export default Evaluation
