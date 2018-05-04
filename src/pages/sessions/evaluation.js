import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import {
  compose,
  withProps,
  withStateHandlers,
  branch,
  renderComponent,
  renderNothing,
} from 'recompose'
import { graphql } from 'react-apollo'

import { CHART_DEFAULTS, QUESTION_GROUPS, QUESTION_TYPES, SESSION_STATUS } from '../../constants'
import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import {
  calculateMax,
  calculateMin,
  calculateMean,
  calculateMedian,
  calculateFirstQuartile,
  calculateThirdQuartile,
  calculateStandardDeviation,
  pageWithIntl,
  withData,
  withLogging,
} from '../../lib'
import { Chart } from '../../components/evaluation'
import { SessionEvaluationQuery } from '../../graphql'
import { sessionStatusShape, statisticsShape } from '../../propTypes'

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
  handleChangeActiveInstance,
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
    pageTitle: intl.formatMessage({
      defaultMessage: 'Evaluation',
      id: 'evaluation.pageTitle',
    }),
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
        handleShowGraph={handleShowGraph}
        intl={intl}
        numBins={bins}
        questionType={type}
        restrictions={options.FREE_RANGE && options.FREE_RANGE.restrictions}
        results={results}
        sessionStatus={sessionStatus}
        showGraph={showGraph}
        showSolution={showSolution}
        statistics={statistics}
      />
    </EvaluationLayout>
  )
}

Evaluation.propTypes = propTypes
Evaluation.defaultProps = defaultProps

export default compose(
  withLogging({
    chatlio: false,
  }),
  withData,
  pageWithIntl,
  graphql(SessionEvaluationQuery, {
    // refetch the active instances query every 10s
    options: ({ url }) => ({ variables: { sessionId: url.query.sessionId } }),
  }),
  // if the query is still loading, display nothing
  branch(({ data }) => data.loading, renderNothing),
  // override the session evaluation query with a polling query
  branch(
    ({ data: { session } }) => session.status === SESSION_STATUS.RUNNING,
    graphql(SessionEvaluationQuery, {
      // refetch the active instances query every 10s
      options: ({ url }) => ({
        pollInterval: 10000,
        variables: { sessionId: url.query.sessionId },
      }),
    }),
  ),
  withProps(({ data: { session } }) => {
    const { blocks } = session

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
      .map((activeInstance) => {
        // map the array of all instances with the custom mapper
        if (QUESTION_GROUPS.CHOICES.includes(activeInstance.question.type)) {
          return {
            ...activeInstance,
            results: {
              data: activeInstance.question.versions[activeInstance.version].options[
                activeInstance.question.type
              ].choices.map((choice, index) => ({
                correct: choice.correct,
                count: activeInstance.results ? activeInstance.results.CHOICES[index] : 0,
                value: choice.name,
              })),
              totalResponses: activeInstance.responses.length,
            },
          }
        }

        if (QUESTION_GROUPS.FREE.includes(activeInstance.question.type)) {
          let data = activeInstance.results ? activeInstance.results.FREE : []

          // values in FREE_RANGE questions need to be numerical
          if (activeInstance.question.type === QUESTION_TYPES.FREE_RANGE) {
            data = data.map(({ value, ...rest }) => ({ ...rest, value: +value }))
          }

          return {
            ...activeInstance,
            results: {
              data,
              totalResponses: activeInstance.responses.length,
            },
          }
        }

        return activeInstance
      })

    return {
      activeInstances,
      // generate an instance summary for easy display of "tabs"
      instanceSummary: activeInstances.map(
        ({
          blockStatus, blockNumber, solution, question, responses,
        }) => ({
          blockNumber,
          blockStatus,
          hasSolution: !!solution,
          title: question.title,
          totalResponses: responses.length,
        }),
      ),
      sessionStatus: session.status,
    }
  }),
  // if the query has finished loading but there are no active instances, show a simple message
  branch(
    ({ activeInstances }) => !(activeInstances && activeInstances.length > 0),
    renderComponent(() => <div>No evaluation currently active.</div>),
  ),
  withStateHandlers(
    ({ activeInstances, sessionStatus }) => ({
      activeInstanceIndex: activeInstances.findIndex(instance => instance.blockStatus === 'ACTIVE'),
      activeVisualizations: CHART_DEFAULTS,
      bins: null,
      showGraph: false,
      showSolution: sessionStatus !== SESSION_STATUS.RUNNING,
    }),
    {
      // handle change of active instance
      handleChangeActiveInstance: () => activeInstanceIndex => ({
        activeInstanceIndex,
      }),

      // handle change in the number of bins
      handleChangeBins: () => bins => ({ bins }),

      // handle change of vis. type
      handleChangeVisualizationType: ({ activeVisualizations }) => (
        questionType,
        visualizationType,
      ) => ({
        activeVisualizations: {
          ...activeVisualizations,
          [questionType]: visualizationType,
        },
      }),

      // handle toggle of the visualization display
      // the visualization display can only be toggled once, so only allow setting to true
      handleShowGraph: () => () => ({ showGraph: true }),

      // handle toggle of the solution overlay
      handleToggleShowSolution: ({ showSolution }) => () => ({ showSolution: !showSolution }),
    },
  ),
  withProps(
    ({
      activeInstances,
      activeInstanceIndex,
      bins,
      handleChangeBins,
      handleChangeActiveInstance,
    }) => {
      const activeInstance = activeInstances[activeInstanceIndex]
      const { question, results } = activeInstance

      if (question.type === QUESTION_TYPES.FREE_RANGE) {
        return {
          activeInstance,
          handleChangeActiveInstance,
          statistics: {
            bins,
            max: calculateMax(results),
            mean: calculateMean(results),
            median: calculateMedian(results),
            min: calculateMin(results),
            onChangeBins: e => handleChangeBins(+e.target.value),
            q1: calculateFirstQuartile(results),
            q3: calculateThirdQuartile(results),
            sd: calculateStandardDeviation(results),
          },
        }
      }

      return {
        activeInstance,
        handleChangeActiveInstance,
      }
    },
  ),
)(Evaluation)
