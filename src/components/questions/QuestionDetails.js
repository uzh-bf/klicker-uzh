import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import { ListWithHeader } from '../common'

const propTypes = {
  lastUsed: PropTypes.array,
}

const defaultProps = {
  lastUsed: [],
}

const QuestionDetails = ({ lastUsed }) => (
  <div className="questionDetails">
    <div className="column">Test1</div>
    <div className="column">Test2</div>
    <div className="column">Test3</div>

    {lastUsed.length > 0 && (
      <div className="column">
        <ListWithHeader items={lastUsed}>
          <FormattedMessage id="questionPool.question.lastUsed" defaultMessage="Last used" />
        </ListWithHeader>
      </div>
    )}

    <style jsx>{`
      @import 'src/theme';

      .questionDetails {
        display: flex;
        flex-direction: column;

        background-color: lightgrey;
        border: 1px solid grey;

        .column {
          text-align: center;
        }

        @include desktop-tablet-only {
          flex-direction: row;
          min-height: 7rem;

          .column {
            flex: 1;
            padding: 1rem;
            text-align: left;

            &:not(:last-child) {
              border-right: 1px solid grey;
            }
          }
        }
      }
    `}</style>
  </div>
)

QuestionDetails.propTypes = propTypes
QuestionDetails.defaultProps = defaultProps

export default QuestionDetails
