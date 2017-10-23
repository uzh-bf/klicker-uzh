import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { compose, withHandlers, withProps, withState, branch, renderComponent } from 'recompose'
import { graphql } from 'react-apollo'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import { pageWithIntl, withData } from '../../lib'
import { Chart } from '../../components/evaluation'
import { ActiveInstancesQuery } from '../../graphql/queries'

const propTypes = {
  activeInstance: PropTypes.number,
  activeInstances: PropTypes.array.isRequired,

  handleChangeActiveInstance: PropTypes.func.isRequired,
  handleChangeVisualizationType: PropTypes.func.isRequired,
  handleShowGraph: PropTypes.func.isRequired,
  handleToggleShowSolution: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  showGraph: PropTypes.bool.isRequired,
  showSolution: PropTypes.bool.isRequired,
  visualizationType: PropTypes.string.isRequired,
}
const defaultProps = {
  activeInstance: 0,
}

function Evaluation({
  activeInstances,
  activeInstance,
  intl,
  handleChangeActiveInstance,
  showGraph,
  showSolution,
  visualizationType,
  handleShowGraph,
  handleToggleShowSolution,
  handleChangeVisualizationType,
}) {
  const { results, question, version } = activeInstances[activeInstance]
  const { title, type } = question
  const { totalResponses } = results
  const { description, options } = question.versions[version]

  const chart = (
    <Chart
      intl={intl}
      handleShowGraph={handleShowGraph}
      results={results}
      showGraph={showGraph}
      showSolution={showSolution}
      visualizationType={visualizationType}
    />
  )

  const layoutProps = {
    activeInstance,
    chart,
    description,
    intl,
    numInstances: activeInstances.length,
    onChangeActiveInstance: handleChangeActiveInstance,
    onChangeVisualizationType: handleChangeVisualizationType,
    onToggleShowSolution: handleToggleShowSolution,
    options,
    pageTitle: intl.formatMessage({
      defaultMessage: 'Evaluation',
      id: 'teacher.evaluation.pageTitle',
    }),
    showSolution,
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
  withState('showGraph', 'setShowGraph', false),
  withState('showSolution', 'setShowSolution', false),
  withState('visualizationType', 'handleChangeVisualizationType', 'PIE_CHART'),
  withState('activeInstance', 'handleChangeActiveInstance', 0),
  withHandlers({
    // handle toggle of the visualization display
    // the visualization display can only be toggled once, so only allow setting to true
    handleShowGraph: ({ setShowGraph }) => () => setShowGraph(true),
    // handle toggle of the solution overlay
    handleToggleShowSolution: ({ setShowSolution }) => () =>
      setShowSolution(showSolution => !showSolution),
  }),
  graphql(ActiveInstancesQuery, {
    // refetch the active instances query every 10s
    options: { pollInterval: 10000 },
  }),
  // if the query is still loading, display nothing
  branch(({ data }) => data.loading, renderComponent(() => null)),
  // if the query has finished loading but there are no active instances, show a simple message
  branch(
    ({ data }) => !(data.activeInstances && data.activeInstances.length > 0),
    renderComponent(() => <div>No evaluation currently active.</div>),
  ),
  withProps(({ data }) => {
    const activeInstance = data.activeInstances[0]

    if (activeInstance.question.type === 'SC') {
      return {
        activeInstances: [
          {
            ...activeInstance,
            results: {
              data: activeInstance.question.versions[0].options.choices.map((choice, index) => ({
                correct: choice.correct,
                count: activeInstance.results ? activeInstance.results.choices[index] : 0,
                value: choice.name,
              })),
              totalResponses: activeInstance.responses.length,
            },
          },
        ],
      }
    }

    if (activeInstance.question.type === 'FREE') {
      return {
        activeInstances: [
          {
            ...activeInstance,
            results: {
              data: activeInstance.results ? activeInstance.results.free : [],
              totalResponses: activeInstance.responses.length,
            },
          },
        ],
      }
    }

    return data.activeInstances
  }),
)(Evaluation)
