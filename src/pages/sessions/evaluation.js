import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage, intlShape } from 'react-intl'
import { compose, withState, withHandlers, withProps } from 'recompose'

import { pageWithIntl, withData } from '../../lib'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import Graph from '../../components/evaluations/Graph'
import SampleSolution from '../../components/evaluations/SampleSolution'
import Visualization from '../../components/evaluations/Visualization'
import Possibilities from '../../components/evaluations/Possibilities'

const propTypes = {
  data: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
}

const Evaluation = ({
  intl,
  showSolution,
  visualizationType,
  handleToggleShowSolution,
  handleChangeVisualizationType,
}) => {
  const data = {
    graph: <Graph intl={intl} showSolution={showSolution} visualization={visualizationType} />,
    possibilities: (
      <Possibilities
        intl={intl}
        options={[
          { text: 'This is the first possible answer' },
          { text: 'This is the second possible answer' },
          { text: 'This is the third possible answer' },
          { text: 'This is the fourth possible answer' },
        ]}
      />
    ),
    questionText:
      'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.',
    sampleSolution: <SampleSolution intl={intl} onChange={handleToggleShowSolution} />,
    title: <FormattedMessage id="teacher.evaluation.title" defaultMessage="Evaluation" />,
    visualization: (
      <Visualization
        intl={intl}
        onChangeType={handleChangeVisualizationType}
        type="SC"
        visualization={visualizationType}
      />
    ),
  }

  return (
    <EvaluationLayout
      data={data}
      intl={intl}
      pageTitle={intl.formatMessage({
        defaultMessage: 'Evaluation',
        id: 'teacher.evaluation.pageTitle',
      })}
    />
  )
}

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
    data: {
      type: 'SC',
    },
  }),
)(Evaluation)

withData(pageWithIntl(Evaluation))
