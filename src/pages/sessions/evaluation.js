import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { intlShape, FormattedMessage } from 'react-intl'

import { pageWithIntl, withData } from '../../lib'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import { RunningSessionQuery } from '../../queries/queries'

const propTypes = {
  data: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
}

class Evaluation extends Component {
  render() {
    const { intl } = this.props

    return (
      <EvaluationLayout
        intl={intl}
        pageTitle={intl.formatMessage({
          defaultMessage: 'Evaluation',
          id: 'teacher.evaluation.pageTitle',
        })}
      >
        <div className="evaluation">
          <b><FormattedMessage id="teacher.evaluation.title" defaultMessage="Evaluation" /></b>
          Hello i am evaluation
        </div>

        <style jsx>{`
          .evaluation{
            display: flex;
            flex-direction: column;

            padding: 1rem;
          }
        `}</style>
      </EvaluationLayout>
    )
  }
}

Evaluation.propTypes = propTypes

export default withData(pageWithIntl(graphql(RunningSessionQuery)(Evaluation)))
