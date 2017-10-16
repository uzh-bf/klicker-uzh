import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { compose, withHandlers, withProps, withState } from 'recompose'

import { pageWithIntl, withData } from '../../lib'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import Graph from '../../components/evaluations/Graph'

const propTypes = {
  data: PropTypes.object.isRequired,
  handleChangeVisualizationType: PropTypes.func.isRequired,
  handleShowGraph: PropTypes.func.isRequired,
  handleToggleShowSolution: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  showGraph: PropTypes.bool.isRequired,
  showSolution: PropTypes.bool.isRequired,
  visualizationType: PropTypes.string.isRequired,
}

const Evaluation = ({
  data,
  intl,
  showGraph,
  showSolution,
  visualizationType,
  handleShowGraph,
  handleToggleShowSolution,
  handleToggleVisualizationActive,
  handleChangeVisualizationType,
}) => (
  <EvaluationLayout
    intl={intl}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Evaluation',
      id: 'teacher.evaluation.pageTitle',
    })}
    title={data.question.title}
    description={data.version.description}
    type={data.question.type}
    choices={data.version.options.choices}
    showSolution={showSolution}
    visualizationType={visualizationType}
    onToggleShowSolution={handleToggleShowSolution}
    onChangeVisualizationType={handleChangeVisualizationType}
  >
    <Graph
      intl={intl}
      handleShowGraph={handleShowGraph}
      result={data.result}
      showGraph={showGraph}
      showSolution={showSolution}
      visualization={visualizationType}
    />
  </EvaluationLayout>
)

Evaluation.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  withState('showGraph', 'setShowGraph', false),
  withState('showSolution', 'setShowSolution', false),
  withState('visualizationActive', 'setVisualizationActive', false),
  withState('visualizationType', 'setVisualizationType', 'PIE_CHART'),
  withHandlers({
    handleChangeVisualizationType: ({ setVisualizationType }) => newType =>
      setVisualizationType(newType),
    handleShowGraph: ({ setShowGraph }) => () => setShowGraph(showGraph => !showGraph),
    handleToggleShowSolution: ({ setShowSolution }) => () =>
      setShowSolution(showSolution => !showSolution),
    // the visualization display can only be toggled once, so only allow setting to true
    handleToggleVisualizationActive: ({ setVisualizationActive }) => () =>
      setVisualizationActive(true),
  }),
  withProps({
    // fake data the component is going to get
    data: {
      question: {
        title: 'some question title',
        type: 'SC',
      },
      result: {
        options: [
          { correct: false, name: 'option 1', numberOfVotes: 56 },
          {
            correct: true,
            name: 'option 2',
            numberOfVotes: 344,
          },
          { correct: false, name: 'some other option', numberOfVotes: 9 },
        ],
        totalResponses: 409,
      },
      version: {
        description:
          'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua.',
        options: {
          choices: [
            { correct: false, name: 'option 1' },
            { correct: true, name: 'option 2' },
            { correct: false, name: 'some other option' },
          ],
          randomized: true,
          restrictions: null,
        },
      },
    },
  }),
)(Evaluation)

withData(pageWithIntl(Evaluation))
