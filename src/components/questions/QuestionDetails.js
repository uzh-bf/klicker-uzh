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
  const maxDescLength = 250
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
      <div className="column col2">
        <p>
          Antworten Total: <strong>999</strong>
        </p>
        <p>
          Korrekte Antworten: <strong>88%</strong>
        </p>
      </div>

      <div className="column col3">
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
        @import 'src/_theme';

        $color_background: rgba(124, 184, 228, 0.12);

        .questionDetails {
          display: flex;
          flex-direction: column;

          background-color: white;
          border: 1px solid $color-primary;

          .column {
            padding: 0.25rem;

            &.description {
              border-bottom: 1px solid $color-primary;
              background-color: $color_background;
            }

            &.col2 {
              display: none;
              border-bottom: 1px solid $color-primary;
            }

            &.col3 {
              display: none;
              border-bottom: 1px solid $color-primary;
            }

            &.buttons {
              display: flex;
              padding: 0;

              :global(.button) {
                flex: 1;
                margin-right: 0.5rem;
              }

              :global(.button:last-child) {
                margin-right: 0;
              }
            }
          }

          @include desktop-tablet-only {
            flex-direction: row;
            min-height: 7rem;

            .column {
              flex: 1;
              padding: 1rem;
              text-align: left;

              &.description {
                border-bottom: none;
              }

              &.col2 {
                display: block;
                border-bottom: none;
              }

              &.col3 {
                display: block;
                border-bottom: none;
              }

              &.buttons {
                display: block;
                flex: none;
                padding: 0.3rem;

                :global(.button) {
                  margin: 0;
                  margin-bottom: 0.3rem;
                  padding: 7px 12px;
                  display: block;
                  background-color: rgba(224, 225, 226, 0.73);
                }

                :global(.button:last-child) {
                  margin-bottom: 0;
                }

                :global(.button:hover) {
                  color: $color-primary !important;
                }
              }

              &:not(:last-child) {
                border-right: 1px solid $color-primary;
              }
            }
          }

          @include desktop-only {
            .column {
              &.col2 {
                flex: 0 0 250px;
              }

              &.col3 {
                flex: 0 0 250px;
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
