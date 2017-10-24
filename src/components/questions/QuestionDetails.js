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

const QuestionDetails = ({ description, lastUsed }) => {
  const maxDescLength = 30
  let newDescription = ''
  let newLastUsed = []

  if (description.length > maxDescLength) {
    newDescription = `${description.substring(0, maxDescLength - 4)} ...`
  } else {
    newDescription = description
  }

  if (lastUsed.length > 0) {
    newLastUsed = lastUsed
  } else {
    newLastUsed = ['never used']
  }

  return (
    <div className="questionDetails">
      <div className="column description">{newDescription}</div>
      <div className="column">
        <p>
          Antworten Total: <strong>999</strong>
        </p>
        <p>
          Korrekte Antworten: <strong>88%</strong>
        </p>
      </div>

      <div className="column">
        <ListWithHeader items={newLastUsed}>
          <FormattedMessage id="questionPool.question.lastUsed" defaultMessage="Last used" />
        </ListWithHeader>
      </div>

      <div className="column buttons">
        <Button className="button">
          <FaEye />
        </Button>
        <Button className="button">
          <FaPencil />
        </Button>
        <Button className="button">
          <FaTrash />
        </Button>
      </div>

    <style jsx>{`
      @import 'src/theme';

      .questionDetails {
        display: flex;
        flex-direction: column;

        background-color: lightgrey;
        border: 1px solid grey;

        @include desktop-tablet-only {
          flex-direction: row;
          min-height: 7rem;

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
                  display: block;
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
}

QuestionDetails.propTypes = propTypes
QuestionDetails.defaultProps = defaultProps

export default QuestionDetails
