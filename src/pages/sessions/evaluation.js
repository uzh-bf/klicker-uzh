import React from 'react'
import PropTypes from 'prop-types'
import { intlShape } from 'react-intl'
import { compose, withState, withHandlers, withProps } from 'recompose'

import { pageWithIntl, withData } from '../../lib'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import Graph from '../../components/evaluations/Graph'

const propTypes = {
  data: PropTypes.object.isRequired,
  handleChangeVisualizationType: PropTypes.func.isRequired,
  handleToggleShowSolution: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  showSolution: PropTypes.bool.isRequired,
  visualizationType: PropTypes.string.isRequired,
}

const Evaluation = ({
  data,
  intl,
  showSolution,
  visualizationType,
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
    <Graph intl={intl} showSolution={showSolution} visualization={visualizationType} />
  </EvaluationLayout>
)

Evaluation.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  withState('showSolution', 'setShowSolution', false),
  // TODO: visualizationActive should decide whether the graph is shown
  // if it is false, a placeholder should be shown
  // a click on said placeholder should then trigger display of the real graph
  withState('visualizationActive', 'setVisualizationActive', false),
  withState('visualizationType', 'setVisualizationType', 'PIE_CHART'),
  withHandlers({
    handleChangeVisualizationType: ({ setVisualizationType }) => newType =>
      setVisualizationType(newType),
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
        options: [56, 344, 9],
        totalResponses: 409,
      },
      version: {
        description:
          'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.',
        options: {
          choices: [{ correct: false, name: 'option 1' },
            { correct: true, name: 'option 2' },
            { correct: false, name: 'some other option' }],
          randomized: true,
          restrictions: null,
        },
      },
    },
  }),
)(Evaluation)

withData(pageWithIntl(Evaluation))
