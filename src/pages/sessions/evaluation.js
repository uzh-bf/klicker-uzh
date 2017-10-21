import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { compose, withHandlers, withProps, withState, branch, renderComponent } from 'recompose'
import { graphql } from 'react-apollo'
import { Message } from 'semantic-ui-react'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import { pageWithIntl, withData } from '../../lib'
import { Chart } from '../../components/evaluation'
import { ActiveInstancesQuery } from '../../graphql/queries'

const propTypes = {
  activeInstances: PropTypes.array.isRequired,
  handleChangeVisualizationType: PropTypes.func.isRequired,
  handleShowGraph: PropTypes.func.isRequired,
  handleToggleShowSolution: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  showGraph: PropTypes.bool.isRequired,
  showSolution: PropTypes.bool.isRequired,
  visualizationType: PropTypes.string.isRequired,
}

function Evaluation({
  activeInstances,
  intl,
  showGraph,
  showSolution,
  visualizationType,
  handleShowGraph,
  handleToggleShowSolution,
  handleChangeVisualizationType,
}) {
  const { results, question } = activeInstances[0]
  const { title, type } = question
  const { totalResponses } = results
  const { description, options } = question.versions[0]

  const chart = (
    <Chart
      intl={intl}
      handleShowGraph={handleShowGraph}
      results={results}
      showGraph={showGraph}
      showSolution={showSolution}
      visualization={visualizationType}
    />
  )

  const layoutProps = {
    chart,
    description,
    intl,
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

export default compose(
  withData,
  pageWithIntl,
  withState('showGraph', 'setShowGraph', false),
  withState('showSolution', 'setShowSolution', false),
  withState('visualizationType', 'setVisualizationType', 'PIE_CHART'),
  withHandlers({
    // handle change of the visualization type
    handleChangeVisualizationType: ({ setVisualizationType }) => newType =>
      setVisualizationType(newType),
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
    renderComponent(() => <Message info>No evaluation currently active.</Message>),
  ),
  withProps(({ data }) => ({
    activeInstances: [
      {
        ...data.activeInstances[0],
        results: {
          choices: [
            { correct: false, name: 'option 1', numberOfVotes: 56 },
            {
              correct: true,
              name: 'option 2',
              numberOfVotes: 344,
            },
            { correct: false, name: 'some other option', numberOfVotes: 9 },
          ],
          totalResponses: data.activeInstances[0].responses.length,
        },
      },
    ],
  })),
)(Evaluation)
