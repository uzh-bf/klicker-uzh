import React from 'react'
import _truncate from 'lodash/truncate'
import Link from 'next/link'

import { Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { ListWithHeader } from '../common'

interface Props {
  description: string
  lastUsed?: any[]
  questionId: string
}

const defaultProps = {
  lastUsed: [],
}

function QuestionDetails({ questionId, description, lastUsed }: Props): React.ReactElement {
  const truncatedDesc = _truncate(description, { length: 250 })

  return (
    <div className="questionDetails">
      <div className="column description">{truncatedDesc}</div>

      <div className="column options" />

      <div className="column lastUsed">
        <ListWithHeader items={lastUsed.length > 0 ? lastUsed : ['-']} limit={2}>
          <Icon name="history" />
          <FormattedMessage defaultMessage="Usage history" id="questionDetails.usageHistory" />
        </ListWithHeader>
      </div>

      <div className="column buttons">
        <Link as={`/questions/${questionId}`} href={{ pathname: '/questions/details', query: { questionId } }}>
          <Button fluid>
            <FormattedMessage defaultMessage="View" id="questionDetails.button.view" />
          </Button>
        </Link>
        <Link as={`/questions/${questionId}`} href={{ pathname: '/questions/details', query: { questionId } }}>
          <Button fluid>
            <FormattedMessage defaultMessage="Edit" id="questionDetails.button.edit" />
          </Button>
        </Link>
        <Link
          as={`/questions/duplicate/${questionId}`}
          href={{ pathname: '/questions/duplicate', query: { questionId } }}
        >
          <Button fluid>
            <FormattedMessage defaultMessage="Duplicate" id="questionDetails.button.duplicate" />
          </Button>
        </Link>
      </div>

      <style jsx>{`
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

QuestionDetails.defaultProps = defaultProps

export default QuestionDetails
