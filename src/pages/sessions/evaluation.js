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

import { QuestionTypes } from '../../constants'
import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import {
  calculateMax,
  calculateMin,
  calculateMean,
  calculateMedian,
  pageWithIntl,
  withData,
} from '../../lib'
import { Chart } from '../../components/evaluation'
import { SessionEvaluationQuery } from '../../graphql/queries'
import { sessionStatusShape, statisticsShape } from '../../propTypes'

const propTypes = {
  activeInstance: PropTypes.object.isRequired,
  activeInstanceIndex: PropTypes.number,
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
  instanceSummary,
  intl,
  handleChangeActiveInstance,
  sessionStatus,
  showGraph,
  showSolution,
  statistics,
  visualizationType,
  handleShowGraph,
  handleToggleShowSolution,
  handleChangeVisualizationType,
}) {
  const { results, question, version } = activeInstance
  const { title, type } = question
  const { totalResponses, data } = results
  const { description, options } = question.versions[version]

  const chart = (
    <Chart
      handleShowGraph={handleShowGraph}
      intl={intl}
      restrictions={options.restrictions}
      results={results}
      sessionStatus={sessionStatus}
      showGraph={showGraph}
      showSolution={showSolution}
      statistics={statistics}
      visualizationType={visualizationType}
    />
  )

  const layoutProps = {
    activeInstance: activeInstanceIndex,
    chart,
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
      id: 'teacher.evaluation.pageTitle',
    }),
    showSolution,
    statistics,
    title,
    totalResponses,
    type,
    visualizationType,
  }

  return <EvaluationLayout {...layoutProps} />
}

Evaluation.propTypes = propTypes
Evaluation.defaultProps = defaultProps

export default compose(
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
    ({ data: { session } }) => session.status === 'RUNNING',
    graphql(SessionEvaluationQuery, {
      // refetch the active instances query every 10s
      options: ({ url }) => ({
        pollInterval: 10000,
        variables: { sessionId: url.query.sessionId },
      }),
    }),
  ),
  withProps(({ data: { session } }) => {
    let { blocks } = session

    // if the session is running, only show open question instances in the evaluation
    if (session.status === 'RUNNING') {
      blocks = blocks.filter(block => block.status === 'ACTIVE')
    }

    // reduce question blocks to the active instances
    const activeInstances = blocks
      .map(block => block.instances) // map blocks to the instances contained within
      .reduce((acc, val) => [...acc, ...val], []) // reduce array of arrays [[], [], []] to [...]
      .map((activeInstance) => {
        // map the array of all instances with the custom mapper
        if ([QuestionTypes.SC, QuestionTypes.MC].includes(activeInstance.question.type)) {
          return {
            ...activeInstance,
            results: {
              // HACK: versioning hardcoded
              data: activeInstance.question.versions[0].options.choices.map((choice, index) => ({
                correct: choice.correct,
                count: activeInstance.results ? activeInstance.results.choices[index] : 0,
                value: choice.name,
              })),
              totalResponses: activeInstance.responses.length,
            },
          }
        }

        if (activeInstance.question.type === QuestionTypes.FREE) {
          return {
            ...activeInstance,
            results: {
              data: activeInstance.results ? activeInstance.results.free : [],
              totalResponses: activeInstance.responses.length,
            },
          }
        }

        return activeInstance
      })

    return {
      activeInstances,
      instanceSummary: activeInstances.map(instance => ({
        title: instance.question.title,
        totalResponses: instance.responses.length,
      })),
      sessionStatus: session.status,
    }
  }),
  // if the query has finished loading but there are no active instances, show a simple message
  branch(
    ({ activeInstances }) => !(activeInstances && activeInstances.length > 0),
    renderComponent(() => <div>No evaluation currently active.</div>),
  ),
  withStateHandlers(
    ({ sessionStatus }) => ({
      activeInstanceIndex: 0,
      showGraph: sessionStatus !== 'RUNNING',
      showSolution: sessionStatus !== 'RUNNING',
      visualizationType: 'PIE_CHART',
    }),
    {
      // handle change of active instance
      handleChangeActiveInstance: () => activeInstanceIndex => () => ({ activeInstanceIndex }),

      // handle change of vis. type
      handleChangeVisualizationType: () => visualizationType => ({ visualizationType }),

      // handle toggle of the visualization display
      // the visualization display can only be toggled once, so only allow setting to true
      handleShowGraph: () => () => ({ showGraph: true }),

      // handle toggle of the solution overlay
      handleToggleShowSolution: ({ showSolution }) => () => ({ showSolution: !showSolution }),
    },
  ),
  withProps(({ activeInstances, activeInstanceIndex }) => {
    const activeInstance = activeInstances[activeInstanceIndex]
    const { question, results } = activeInstance

    // TODO: update question type to FREE:RANGE
    if (question.type === 'FREE') {
      return {
        activeInstance,
        statistics: {
          max: calculateMax(results),
          mean: calculateMean(results),
          median: calculateMedian(results),
          min: calculateMin(results),
        },
      }
    }

    return {
      activeInstance,
    }
  }),
)(Evaluation)
