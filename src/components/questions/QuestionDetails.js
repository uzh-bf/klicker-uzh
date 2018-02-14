import React from 'react'
import PropTypes from 'prop-types'
import _truncate from 'lodash/truncate'
import Link from 'next/link'

import { Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { ListWithHeader } from '../common'

const propTypes = {
  description: PropTypes.string.isRequired,
  lastUsed: PropTypes.array,
  questionId: PropTypes.string.isRequired,
}

const defaultProps = {
  lastUsed: [],
}

const QuestionDetails = ({ questionId, description, lastUsed }) => {
  const truncatedDesc = _truncate(description, { length: 250 })

  // TODO: internationalization
  return (
    <div className="questionDetails">
      <div className="column description">{truncatedDesc}</div>

      <div className="column options" />

      <div className="column lastUsed">
        <ListWithHeader items={lastUsed.length > 0 ? lastUsed : ['-']}>
          <Icon name="history" />
          <FormattedMessage defaultMessage="Usage history" id="questionDetails.usageHistory" />
        </ListWithHeader>
      </div>

      <div className="column buttons">
        <Link
          as={`/questions/${questionId}`}
          href={{ pathname: '/questions/details', query: { questionId } }}
        >
          <Button icon="pencil" />
        </Link>
      </div>

      <style jsx>{`
        // TODO: externalize colors

        @import 'src/theme';

        .questionDetails {
          display: flex;
          flex-direction: column;

          background-color: white;
          border: 1px solid $color-primary;

          .column {
            padding: 0.25rem;
          }

          .description {
            border-bottom: 1px solid $color-primary;
            background-color: $color-primary-background;
          }

          .options {
            display: none;
            border-bottom: 1px solid $color-primary;
          }

          .lastUsed {
            display: none;
            border-bottom: 1px solid $color-primary;
          }

          .buttons {
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

          @include desktop-tablet-only {
            flex-direction: row;

            .column {
              flex: 1;
              padding: 0.7rem;
              text-align: left;

              &:not(:last-child) {
                border-right: 1px solid $color-primary;
              }
            }

            .description {
              border-bottom: none;
            }

            .options {
              border-bottom: none;
            }

            .lastUsed {
              display: block;
              border-bottom: none;
              text-align: center;

              padding: 0;
            }

            .buttons {
              display: block;
              flex: none;
              padding: 0.3rem;

              :global(button) {
                margin: 0;
                margin-bottom: 0.3rem;
                padding: 7px 12px;
                display: block;
                background-color: rgba(224, 225, 226, 0.73);
              }

              :global(button:last-child) {
                margin-bottom: 0;
              }

              :global(button:hover) {
                color: $color-primary !important;
              }
            }
          }

          @include desktop-only {
            .options {
              flex: 0 0 12rem;
            }

            .lastUsed {
              flex: 0 0 12rem;
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
