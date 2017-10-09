import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { FormattedMessage, intlShape } from 'react-intl'

import { pageWithIntl, withData } from '../../lib'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import SampleSolution from '../../components/evaluations/SampleSolution'
import Visualization from '../../components/evaluations/Visualization'
import Possibilities from '../../components/evaluations/Possibilities'
import { RunningSessionQuery } from '../../queries/queries'


const propTypes = {
  data: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
}

class Evaluation extends Component {
  render() {
    const { intl } = this.props

    const data = {
      possibilities: <Possibilities intl={intl} />,
      questionText:
        'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet.',
      sampleSolution: <SampleSolution intl={intl} />,
      title: <FormattedMessage id="teacher.evaluation.title" defaultMessage="Evaluation" />,
      visualization: <Visualization intl={intl} />,
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
