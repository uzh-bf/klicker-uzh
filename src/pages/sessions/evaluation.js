import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { graphql } from 'react-apollo'
import { intlShape } from 'react-intl'

import { pageWithIntl, withData } from '../../lib'

import EvaluationLayout from '../../components/layouts/EvaluationLayout'
import { RunningSessionQuery } from '../../queries/queries'

const propTypes = {
  data: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
}

class Evaluation extends Component {
  render() {
    const { data, intl } = this.props

    return (
      <EvaluationLayout
        pageTitle={intl.formatMessage({
          defaultMessage: 'Running Session',
          id: 'teacher.runningSession.pageTitle',
        })}
        sidebar={{ activeItem: 'runningSession' }}
      >
        <div className="runningSession">
          <div className="sessionProgress">hello
          </div>
        </div>

        <style jsx>{`
          .runningSession {
            display: flex;
            flex-direction: column;

            padding: 1rem;
          }

          @media all and (min-width: 768px) {
            .runningSession {
              flex-flow: row wrap;

              padding: 2rem;
            }

            .sessionProgress,
            .feedbackChannel {
              padding: 0.5rem;
            }

            .sessionProgress {
              flex: 0 0 100%;
            }

          }

          @media all and (min-width: 991px) {
            .runningSession {
              padding: 2rem 10%;
            }
          }
        `}</style>
      </EvaluationLayout>
    )
  }
}

Evaluation.propTypes = propTypes

export default withData(pageWithIntl(graphql(RunningSessionQuery)(Evaluation)))
