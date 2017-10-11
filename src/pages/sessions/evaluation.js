import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { FormattedMessage, intlShape } from 'react-intl'

import { pageWithIntl, withData } from '../../lib'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import Graph from '../../components/evaluations/Graph'
import SampleSolution from '../../components/evaluations/SampleSolution'
import Visualization from '../../components/evaluations/Visualization'
import Possibilities from '../../components/evaluations/Possibilities'
import { RunningSessionQuery } from '../../queries/queries'

const propTypes = {
  data: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
}

class Evaluation extends Component {
  constructor(props) {
    super(props)

    this.state = {
      visualization: 'pieChart', // initial visualization type
    }
  }

  onChangeVisualizationType = (newType) => {
    this.setState({ ...this.state, visualization: newType })
  }

  render() {
    const { intl } = this.props

    const objectIGet = {
      type: 'SC', // SC, FREE ...
    }

    const data = {
      graph: <Graph intl={intl} visualization={this.state.visualization} />,
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
      sampleSolution: <SampleSolution intl={intl} />,
      title: <FormattedMessage id="teacher.evaluation.title" defaultMessage="Evaluation" />,
      visualization: (
        <Visualization
          intl={intl}
          onChangeType={this.onChangeVisualizationType}
          type={objectIGet.type}
          visualization={this.state.visualization}
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
}

Evaluation.propTypes = propTypes

export default withData(pageWithIntl(graphql(RunningSessionQuery)(Evaluation)))
