import React from 'react'
import PropTypes from 'prop-types'
import _round from 'lodash/round'
import _get from 'lodash/get'
import { defineMessages, intlShape } from 'react-intl'
import { compose, withProps, withStateHandlers, branch, renderComponent, renderNothing } from 'recompose'
import { withRouter } from 'next/router'
import { graphql } from 'react-apollo'
import { max, min, mean, median, quantileSeq, std } from 'mathjs'

import { CHART_DEFAULTS, QUESTION_GROUPS, QUESTION_TYPES, SESSION_STATUS } from '../../constants'
import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import { toValueArray, pageWithIntl, withLogging } from '../../lib'
import { Chart } from '../../components/evaluation'
import { SessionEvaluationQuery, SessionEvaluationPublicQuery } from '../../graphql'
import { sessionStatusShape, statisticsShape } from '../../propTypes'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Evaluation',
    id: 'evaluation.pageTitle',
  },
})

const propTypes = {
  activeInstance: PropTypes.object.isRequired,
  activeInstanceIndex: PropTypes.number,
  activeVisualizations: PropTypes.object.isRequired,
  bins: PropTypes.number.isRequired,
  handleChangeActiveInstance: PropTypes.func.isRequired,
  handleChangeVisualizationType: PropTypes.func.isRequired,
  handleShowGraph: PropTypes.func.isRequired,
  handleToggleShowSolution: PropTypes.func.isRequired,
  instanceSummary: PropTypes.arrayOf(PropTypes.object),
  intl: intlShape.isRequired,
  isPublic: PropTypes.bool.isRequired,
  sessionId: PropTypes.string.isRequired,
  sessionStatus: sessionStatusShape.isRequired,
  showGraph: PropTypes.bool.isRequired,
  showSolution: PropTypes.bool.isRequired,
  statistics: statisticsShape,
  visualizationType: PropTypes.string.isRequired,
}
const defaultProps = {
  activeInstanceIndex: 0,
  instanceSummary: [],
  statistics: undefined,
}

function Evaluation({
  activeInstanceIndex,
  activeInstance,
  activeVisualizations,
  bins,
  instanceSummary,
  intl,
  isPublic,
  handleChangeActiveInstance,
  sessionId,
  sessionStatus,
  showGraph,
  showSolution,
  statistics,
  handleShowGraph,
  handleToggleShowSolution,
  handleChangeVisualizationType,
}) {
  const { results, question, version } = activeInstance
  const { title, type } = question
  const { totalResponses, data } = results
  const { description, options } = question.versions[version]

  const layoutProps = {
    activeInstance: activeInstanceIndex,
    activeVisualization: activeVisualizations[type],
    data,
    description,
    instanceSummary,
    intl,
    onChangeActiveInstance: handleChangeActiveInstance,
    onChangeVisualizationType: handleChangeVisualizationType,
    onToggleShowSolution: handleToggleShowSolution,
    options,
    pageTitle: intl.formatMessage(messages.pageTitle),
    showGraph,
    showSolution,
    statistics,
    title,
    totalResponses,
    type,
  }

  return (
    <EvaluationLayout {...layoutProps}>
      <Chart
        activeVisualization={activeVisualizations[type]}
        data={results.data}
        handleShowGraph={handleShowGraph}
        instanceId={activeInstance.id}
        intl={intl}
        isPublic={isPublic}
        numBins={bins}
        questionType={type}
        restrictions={options.FREE_RANGE && options.FREE_RANGE.restrictions}
        sessionId={sessionId}
        sessionStatus={sessionStatus}
        showGraph={showGraph}
        showSolution={showSolution}
        statistics={statistics}
        totalResponses={results.totalResponses}
      />
    </EvaluationLayout>
  )
}

Evaluation.propTypes = propTypes
Evaluation.defaultProps = defaultProps

export default compose(
  withRouter,
  withLogging(),
  pageWithIntl,
  withProps(({ router }) => ({
    isPublic: !!router.query.public,
    sessionId: router.query.sessionId,
  })),
  branch(
    ({ isPublic }) => isPublic,
    graphql(SessionEvaluationPublicQuery, {
      options: ({ sessionId }) => ({
        variables: { sessionId },
      }),
    }),
    graphql(SessionEvaluationQuery, {
      options: ({ sessionId }) => ({
        variables: { sessionId },
      }),
    })
  ),
  // if the query is still loading, display nothing
  branch(
    ({ data: { loading, session, sessionPublic }, isPublic }) =>
      loading || (!isPublic && !session) || (isPublic && !sessionPublic),
    renderNothing
  ),
  // override the session evaluation query with a polling query
  // only if the session is not being publicly accessed
  branch(
    ({ data: { session }, isPublic }) => !isPublic && session.status === SESSION_STATUS.RUNNING,
    graphql(SessionEvaluationQuery, {
      // refetch the active instances query every 10s
      options: ({ sessionId }) => ({
        pollInterval: 7000,
        variables: { sessionId },
      }),
    })
  ),
  // if the session is publicly accessed, override the session with its public counterpart
  withProps(({ data: { session, sessionPublic }, isPublic }) => ({
    session: isPublic ? sessionPublic : session,
  })),
  withProps(({ session, session: { blocks } }) => {
    // reduce question blocks to the active instances
    const activeInstances = blocks
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
  }),
  // if the query has finished loading but there are no active instances, show a simple message
  branch(
    ({ activeInstances }) => !(activeInstances && activeInstances.length > 0),
    renderComponent(() => <div>No evaluation currently active.</div>)
  ),
  withStateHandlers(
    ({ activeInstances, sessionStatus }) => {
      const firstActiveIndex = activeInstances.findIndex(instance => instance.blockStatus === 'ACTIVE')
      return {
        activeInstanceIndex: firstActiveIndex >= 0 ? firstActiveIndex : 0,
        activeVisualizations: CHART_DEFAULTS,
        bins: null,
        showGraph: false,
        showSolution: sessionStatus !== SESSION_STATUS.RUNNING,
      }
    },
    {
      // handle change of active instance
      handleChangeActiveInstance: () => activeInstanceIndex => ({
        activeInstanceIndex,
      }),

      // handle change in the number of bins
      handleChangeBins: () => bins => ({ bins }),

      // handle change of vis. type
      handleChangeVisualizationType: ({ activeVisualizations }) => (questionType, visualizationType) => ({
        activeVisualizations: {
          ...activeVisualizations,
          [questionType]: visualizationType,
        },
      }),

      // handle toggle of the visualization display
      // the visualization display can only be toggled once, so only allow setting to true
      handleShowGraph: () => () => ({ showGraph: true }),

      // handle toggle of the solution overlay
      handleToggleShowSolution: ({ showSolution }) => () => ({
        showSolution: !showSolution,
      }),
    }
  ),
  withProps(({ activeInstances, activeInstanceIndex, bins, handleChangeBins, handleChangeActiveInstance }) => {
    const activeInstance = activeInstances[activeInstanceIndex]
    const { question, results } = activeInstance

    if (question.type === QUESTION_TYPES.FREE_RANGE) {
      // convert the result data into an array with primitive numbers
      const valueArray = toValueArray(results.data)
      const hasResults = valueArray.length > 0

      return {
        activeInstance,
        handleChangeActiveInstance,
        statistics: {
          bins,
          max: hasResults && max(valueArray),
          mean: hasResults && mean(valueArray),
          median: hasResults && median(valueArray),
          min: hasResults && min(valueArray),
          onChangeBins: e => handleChangeBins(+e.target.value),
          q1: hasResults && quantileSeq(valueArray, 0.25),
          q3: hasResults && quantileSeq(valueArray, 0.75),
          sd: hasResults && std(valueArray),
        },
      }
    }

    const resultsWithPercentages = {
      ...activeInstance.results,
      data:
        _get(activeInstance, 'results.data') &&
        activeInstance.results.data.map(({ correct, count, value }) => ({
          correct,
          count,
          percentage: _round(100 * (count / _get(activeInstance, 'results.totalResponses')), 1),
          value,
        })),
      totalResponses: _get(activeInstance, 'results.totalResponses'),
    }

    return {
      activeInstance: {
        ...activeInstance,
        results: resultsWithPercentages,
      },
      handleChangeActiveInstance,
    }
  })
)(Evaluation)
