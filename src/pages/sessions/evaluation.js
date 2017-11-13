import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { compose, withHandlers, withProps, withState, branch, renderComponent } from 'recompose'
import { graphql } from 'react-apollo'

import { QuestionTypes } from '../../constants'
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
  instanceTitles: PropTypes.arrayOf(PropTypes.string),
  intl: intlShape.isRequired,
  showGraph: PropTypes.bool.isRequired,
  showSolution: PropTypes.bool.isRequired,
  visualizationType: PropTypes.string.isRequired,
}
const defaultProps = {
  activeInstance: 0,
  instanceTitles: [],
}

const mapActiveInstance = (activeInstance) => {
  if ([QuestionTypes.SC, QuestionTypes.MC].includes(activeInstance.question.type)) {
    return {
      ...activeInstance,
      results: {
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
}

function Evaluation({
  activeInstances,
  activeInstance,
  instanceTitles,
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
  const { totalResponses, data } = results
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
    data,
    description,
    instanceTitles,
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
  withState('activeInstance', 'setActiveInstance', 0),
  withHandlers({
    handleChangeActiveInstance: ({ setActiveInstance }) => newInstance => () =>
      setActiveInstance(newInstance),
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
  withProps(({ data }) => ({
    activeInstances: data.activeInstances.map(mapActiveInstance),
    instanceTitles: data.activeInstances.map(instance => instance.question.title),
  })),
)(Evaluation)
