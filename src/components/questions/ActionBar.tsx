import React from 'react'
import Link from 'next/link'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Confirm, Icon, Label } from 'semantic-ui-react'

const messages = defineMessages({
  deletionConfirmationCancel: {
    defaultMessage: 'Cancel',
    id: 'questionPool.button.deletionConfirmationCancel',
  },
  deletionConfirmationConfirm: {
    defaultMessage: 'Delete {num} question(s)!',
    id: 'questionPool.button.deletionConfirmationConfirm',
  },
  deletionConfirmationContent: {
    defaultMessage:
      'Are you sure you want to delete the {num} selected questions? Consider moving them to the archive if you could have use for them in the future.',
    id: 'questionPool.string.deletionConfirmationContent',
  },
})

interface Props {
  creationMode?: boolean
  deletionConfirmation: boolean
  handleArchiveQuestions: any
  handleCreationModeToggle: any
  handleDeleteQuestions: any
  handleQuickBlock: any
  handleQuickBlocks: any
  handleGetQuestionStatistics: any
  isArchiveActive?: boolean
  itemsChecked?: number
}

const defaultProps = {
  creationMode: false,
  isArchiveActive: false,
  itemsChecked: 0,
}

function ActionBar({
  isArchiveActive,
  creationMode,
  deletionConfirmation,
  itemsChecked,
  handleArchiveQuestions,
  handleCreationModeToggle,
  handleDeleteQuestions,
  handleQuickBlock,
  handleQuickBlocks,
  handleGetQuestionStatistics,
}: Props): React.ReactElement {
  const intl = useIntl()

  return (
    <div className="actionBar">
      <div className="actionButtons">
        <Link href="/questions/create">
          <Button primary>
            <FormattedMessage defaultMessage="Create Question" id="questionPool.button.createQuestion" />
          </Button>
        </Link>

        <Button primary disabled={!!creationMode} onClick={handleCreationModeToggle}>
          <FormattedMessage defaultMessage="Create Session" id="questionPool.button.createSession" />
        </Button>
      </div>

      <div className="creationButtons">
        {creationMode ? (
          <>
            <Button
              icon
              disabled={itemsChecked <= 1}
              labelPosition="left"
              size="small"
              onClick={(): void => handleQuickBlocks()}
            >
              <Icon name="lightning" />
              <FormattedMessage
                defaultMessage="Split questions into {num} blocks"
                id="questionPool.button.quickCreateSeparate"
                values={{ num: +itemsChecked }}
              />
            </Button>

            <Button
              icon
              disabled={itemsChecked === 0}
              labelPosition="left"
              size="small"
              onClick={(): void => handleQuickBlock()}
            >
              <Icon name="lightning" />
              <FormattedMessage
                defaultMessage="Group questions into one block ({num}->1)"
                id="questionPool.button.quickCreateSingle"
                values={{ num: +itemsChecked }}
              />
            </Button>
          </>
        ) : (
          <>
            <Button
              icon
              disabled={itemsChecked === 0}
              labelPosition="left"
              size="small"
              onClick={handleGetQuestionStatistics}
            >
              <Icon name="calculator" />
              <FormattedMessage defaultMessage="Statistics" id="questionPool.button.computeStatistics" />
            </Button>

            <Button
              icon
              disabled={itemsChecked === 0}
              labelPosition="left"
              size="small"
              onClick={(): void => handleArchiveQuestions()}
            >
              <Icon name="archive" />
              {isArchiveActive ? (
                <FormattedMessage defaultMessage="Unarchive" id="questionPool.button.unarchiveQuestions" />
              ) : (
                <FormattedMessage defaultMessage="Archive" id="questionPool.button.archiveQuestions" />
              )}
            </Button>

            <Button
              icon
              disabled={itemsChecked === 0}
              labelPosition="left"
              size="small"
              onClick={(): void => handleDeleteQuestions(false)}
            >
              <Icon name="trash" />
              <FormattedMessage defaultMessage="Delete" id="questionPool.button.deleteQuestions" />
            </Button>

            <Confirm
              cancelButton={intl.formatMessage(messages.deletionConfirmationCancel)}
              confirmButton={intl.formatMessage(messages.deletionConfirmationConfirm, { num: +itemsChecked })}
              content={intl.formatMessage(messages.deletionConfirmationContent, { num: +itemsChecked })}
              open={deletionConfirmation}
              onCancel={(): void => handleDeleteQuestions(false)}
              onConfirm={(): void => handleDeleteQuestions(true)}
            />
          </>
        )}
      </div>

      <Label className="checkedCounter">
        <Icon name="thumbtack" />
        <FormattedMessage
          defaultMessage="{count} items checked"
          id="questionPool.string.itemsChecked"
          values={{ count: +itemsChecked }}
        />
      </Label>

      <style jsx>
        {`
          @import 'src/theme';

          .actionBar,
          .actionButtons,
          .creationButtons {
            display: flex;
            flex-direction: column;
          }

          .actionBar {
            padding: 1rem;

            .actionButtons,
            .creationButtons {
              flex: 1;
            }

            @include desktop-tablet-only {
              flex-flow: row wrap;
              align-items: center;
              justify-content: space-between;
              padding: 0;

              .creationButtons,
              .actionButtons {
                flex: 0 0 auto;
                flex-direction: row;

                > :global(button:last-child) {
                  margin-right: 0;
                }
              }

              .checkedCounter {
                color: grey;
                order: 1;
              }

              .creationButtons {
                order: 2;
              }

              .actionButtons {
                order: 3;
              }
            }
          }
        `}
      </style>
    </div>
  )
}

ActionBar.defaultProps = defaultProps

export default ActionBar
