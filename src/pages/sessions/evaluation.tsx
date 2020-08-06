import React from 'react'
import _get from 'lodash/get'
import { defineMessages, useIntl } from 'react-intl'
import { useRouter } from 'next/router'

import { QUESTION_GROUPS, QUESTION_TYPES } from '../../constants'
import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import useLogging from '../../lib/hooks/useLogging'
import Chart from '../../components/evaluation/Chart'
import LoadSessionData from '../../components/sessions/LoadSessionData'
import ComputeActiveInstance from '../../components/sessions/ComputeActiveInstance'
import { withApollo } from '../../lib/apollo'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Evaluation',
    id: 'evaluation.pageTitle',
  },
})

export function reduceActiveInstances(allInstances: any[], { instances, status }, index: number): any[] {
  // inject the status of the block into the instance object
  const instancesWithBlockStatus = instances.map((instance): any => ({
    ...instance,
    blockNumber: index + 1,
    blockStatus: status,
  }))
  // reduce to a list of all instances, no matter the block status
  // reduce array of arrays [[], [], []] to [...]
  return [...allInstances, ...instancesWithBlockStatus]
}

export function mapActiveInstance(activeInstance: any): any {
  // map the array of all instances with the custom mapper
  if (QUESTION_GROUPS.CHOICES.includes(activeInstance.question.type)) {
    return {
      ...activeInstance,
      results: {
        data: activeInstance.question.versions[activeInstance.version].options[
          activeInstance.question.type
        ].choices.map((choice, index): any => ({
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
      data = data.map(({ value, ...rest }): any => ({
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
}

export function extractInstancesFromSession(session): any {
  const blocks = _get(session, 'blocks')
  const feedback = _get(session, 'feedback')
  if (!blocks) {
    console.error('no blocks', session)
    return {
      activeInstances: [],
      instanceSummary: [],
      sessionStatus: _get(session, 'status'),
    }
  }

  // reduce question blocks to the active instances
  const activeInstances = blocks
    // filter out future blocks as we don't want to display them too early
    .filter((block): boolean => block.status !== 'PLANNED')
    .reduce(reduceActiveInstances, [])
    .map(mapActiveInstance)

  return {
    activeInstances,
    feedback,
    // generate an instance summary for easy display of "tabs"
    instanceSummary: activeInstances.map(({ blockStatus, blockNumber, solution, question, results }): any => ({
      blockNumber,
      blockStatus,
      hasSolution: !!solution,
      title: question.title,
      totalResponses: _get(results, 'totalResponses') || 0,
    })),
    sessionStatus: _get(session, 'status'),
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
      {({ session, loading, error }): React.ReactElement => {
        if (loading || error || !_get(session, 'blocks')) {
          return null
        }

        const { activeInstances, sessionStatus, instanceSummary } = extractInstancesFromSession(session)

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
              const { description, options, files } = question.versions[version]

              const layoutProps = {
                activeInstances,
                activeInstance: activeInstanceIndex,
                activeVisualization: activeVisualizations[question.type],
                data: results.data,
                description,
                instanceSummary,
                onChangeActiveInstance: setActiveInstanceIndex,
                onChangeVisualizationType: (questionType, visualizationType): void =>
                  setActiveVisualizations({
                    ...activeVisualizations,
                    [questionType]: visualizationType,
                  }),
                onToggleShowSolution: (): void => setShowSolution(!showSolution),
                options,
                pageTitle: intl.formatMessage(messages.pageTitle),
                sessionId,
                showGraph,
                files,
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
                    handleShowGraph={(): void => setShowGraph(true)}
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

export default withApollo()(Evaluation)
