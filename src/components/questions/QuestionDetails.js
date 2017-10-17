import React from 'react'
import PropTypes from 'prop-types'
import { FormattedMessage } from 'react-intl'

import { FaEye, FaPencil, FaTrash } from 'react-icons/lib/fa'

import { Button } from 'semantic-ui-react'

import { ListWithHeader } from '../common'

const propTypes = {
  description: PropTypes.string.isRequired,
  lastUsed: PropTypes.array,
}

const defaultProps = {
  lastUsed: [],
}

const QuestionDetails = ({ description, lastUsed }) => (
  <div className="questionDetails">
    <div className="column description">
      <i>{description}</i>
    </div>
    <div className="column">
      <p>
        <strong>Antworten Total:</strong> 999
      </p>
      <p>
        <strong>Korrekte Antworten:</strong> 88%
      </p>
    </div>
    <div className="column">Test3</div>

    <div className="column">
      {lastUsed.length > 0 && (
        <ListWithHeader items={lastUsed}>
          <FormattedMessage id="questionPool.question.lastUsed" defaultMessage="Last used" />
        </ListWithHeader>
      )}

      {lastUsed.length === 0 && (
        <ListWithHeader items={['never used']}>
          <FormattedMessage id="questionPool.question.lastUsed" defaultMessage="Last used" />
        </ListWithHeader>
      )}
    </div>

    <div className="column buttons">
      <div>
        <Button className="button">
          <FaEye />
        </Button>
      </div>
      <div>
        <Button className="button">
          <FaPencil />
        </Button>
      </div>
      <div>
        <Button className="button">
          <FaTrash />
        </Button>
      </div>
    </div>

    <style jsx>{`
      .questionDetails {
        display: flex;
        flex-direction: column;

        background-color: lightgrey;
        border: 1px solid grey;

        .column {
          text-align: center;
        }

        @media all and (min-width: 768px) {
          flex-direction: row;
          min-height: 7rem;

          .column {
            flex: 1;
            padding: 1rem;
            text-align: left;

            &.description {
              word-wrap: break-word;
            }

            &.buttons {
              padding: 0;
              flex: none;

              :global(.button) {
                margin: 0;
                margin-bottom: 5px;
              }

              :global(.button:last) {
                margin-bottom: 0;
              }
            }

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
