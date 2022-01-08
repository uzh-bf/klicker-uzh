import React, { useState } from 'react'
import _truncate from 'lodash/truncate'

import { Icon, Button } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import ListWithHeader from '../common/ListWithHeader'
import QuestionDetailsModal from './QuestionDetailsModal'
import QuestionDuplicationModal from './QuestionDuplicationModal'

interface Props {
  description: string
  lastUsed?: any[]
  questionId: string
  isModificationModalOpen: boolean
  setIsModificationModalOpen: any
}

const defaultProps = {
  lastUsed: [],
}

function QuestionDetails({
  questionId,
  description,
  lastUsed,
  isModificationModalOpen,
  setIsModificationModalOpen,
}: Props): React.ReactElement {
  const [isDuplicationModalOpen, setIsDuplicationModalOpen] = useState(false)

  const truncatedDesc = _truncate(description, { length: 200 })

  return (
    <div className="bg-white border border-solid questionDetails border-primary">
      <div className="break-all border-solid column description bg-primary-bg border-b-only border-primary md:border-b-0 md:border-r hyphens-auto">
        {truncatedDesc}
      </div>

      <div className="border-solid column options border-b-only border-primary md:border-b-0 md:border-r" />

      <div className="border-solid column lastUsed border-b-only border-primary md:border-b-0 md:border-r">
        <ListWithHeader items={lastUsed.length > 0 ? lastUsed.reverse() : ['-']} limit={2}>
          <Icon name="history" />
          <FormattedMessage defaultMessage="Usage history" id="questionDetails.usageHistory" />
        </ListWithHeader>
      </div>

      <div className="column buttons">
        <Button basic fluid onClick={(): void => setIsModificationModalOpen(true)}>
          <FormattedMessage defaultMessage="View / Edit" id="questionDetails.button.edit" />
        </Button>
        {isModificationModalOpen && (
          <QuestionDetailsModal
            handleSetIsOpen={setIsModificationModalOpen}
            isOpen={isModificationModalOpen}
            questionId={questionId}
          />
        )}

        <Button basic fluid onClick={(): void => setIsDuplicationModalOpen(true)}>
          <FormattedMessage defaultMessage="Duplicate" id="questionDetails.button.duplicate" />
        </Button>
        {isDuplicationModalOpen && (
          <QuestionDuplicationModal
            handleSetIsOpen={setIsDuplicationModalOpen}
            isOpen={isDuplicationModalOpen}
            questionId={questionId}
          />
        )}
      </div>

      <style jsx>{`
        @import 'src/theme';

        .questionDetails {
          display: flex;
          flex-direction: column;

          .column {
            padding: 0.25rem;
          }

          .options {
            display: none;
          }

          .lastUsed {
            display: none;
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
            }

            .lastUsed {
              display: block;
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
              }

              :global(button:last-child) {
                margin-bottom: 0;
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
