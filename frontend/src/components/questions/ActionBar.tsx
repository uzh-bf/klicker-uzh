import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import _sortBy from 'lodash/sortBy'
import { CSVDownload } from 'react-csv'
import { useToasts } from 'react-toast-notifications'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Confirm, Icon, Label } from 'semantic-ui-react'
import { useMutation } from '@apollo/react-hooks'

import QuestionStatisticsMutation from '../../graphql/mutations/QuestionStatisticsMutation.graphql'

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
  isArchiveActive?: boolean
  itemsChecked?: string[]
}

const defaultProps = {
  creationMode: false,
  isArchiveActive: false,
  itemsChecked: [],
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
}: Props): React.ReactElement {
  const intl = useIntl()
  const { addToast } = useToasts()
  const [csvData, setCsvData] = useState()

  const [getQuestionStatistics, { data, error, loading }] = useMutation(QuestionStatisticsMutation)

  useEffect((): void => {
    if (data) {
      const versionResults = {}

      data.questionStatistics.forEach(({ id, title, type, usageTotal, usageDetails, statistics }): void => {
        usageDetails.forEach(({ version, count }): void => {
          versionResults[`${id}_v${version}`] = {
            _title: title,
            _type: type,
            _question: id,
            _usageTotal: usageTotal,
            _usageVersion: count,
            _version: version,
          }
        })

        statistics.forEach(({ version, CHOICES, FREE }): void => {
          if (type === 'SC' || type === 'MC') {
            _sortBy(CHOICES, (choice): boolean => choice.chosen)
              .reverse()
              .forEach(({ name, correct, chosen, total, percentageChosen }, ix): void => {
                versionResults[`${id}_v${version}`][`c${ix}_name`] = name
                versionResults[`${id}_v${version}`][`c${ix}_correct`] = correct ? 'T' : 'F'
                versionResults[`${id}_v${version}`][`c${ix}_chosen`] = chosen
                versionResults[`${id}_v${version}`][`c${ix}_total`] = total
                versionResults[`${id}_v${version}`][`c${ix}_percentageChosen`] = percentageChosen
              })
          } else if (type === 'FREE' || type === 'FREE_RANGE') {
            _sortBy(FREE, (free): boolean => free.chosen)
              .reverse()
              .forEach(({ value, chosen, total, percentageChosen }, ix): void => {
                versionResults[`${id}_v${version}`][`f${ix}_value`] = value
                versionResults[`${id}_v${version}`][`f${ix}_chosen`] = chosen
                versionResults[`${id}_v${version}`][`f${ix}_total`] = total
                versionResults[`${id}_v${version}`][`f${ix}_percentageChosen`] = percentageChosen
              })
          }
        })
      })

      setCsvData(Object.values(versionResults))
    } else if (error) {
      addToast(error.message, { appearance: 'error' })
    }
  }, [loading, data, error])

  const onGetQuestionStatistics = async (): Promise<void> => {
    setCsvData(null)
    try {
      await getQuestionStatistics({
        variables: { ids: itemsChecked },
      })
    } catch (e) {
      console.error(e.message)
    }
  }

  const itemCount = itemsChecked.length

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
              disabled={itemCount <= 1}
              labelPosition="left"
              size="small"
              onClick={(): void => handleQuickBlocks()}
            >
              <Icon name="lightning" />
              <FormattedMessage
                defaultMessage="Split questions into {num} blocks"
                id="questionPool.button.quickCreateSeparate"
                values={{ num: itemCount }}
              />
            </Button>

            <Button
              icon
              disabled={itemCount === 0}
              labelPosition="left"
              size="small"
              onClick={(): void => handleQuickBlock()}
            >
              <Icon name="lightning" />
              <FormattedMessage
                defaultMessage="Group questions into one block ({num}->1)"
                id="questionPool.button.quickCreateSingle"
                values={{ num: itemCount }}
              />
            </Button>
          </>
        ) : (
          <>
            <Button icon disabled={itemCount === 0} labelPosition="left" size="small" onClick={onGetQuestionStatistics}>
              <Icon name="calculator" />
              <FormattedMessage defaultMessage="Statistics" id="questionPool.button.computeStatistics" />
            </Button>

            <Button
              icon
              disabled={itemCount === 0}
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
              disabled={itemCount === 0}
              labelPosition="left"
              size="small"
              onClick={(): void => handleDeleteQuestions(false)}
            >
              <Icon name="trash" />
              <FormattedMessage defaultMessage="Delete" id="questionPool.button.deleteQuestions" />
            </Button>

            <Confirm
              cancelButton={intl.formatMessage(messages.deletionConfirmationCancel)}
              confirmButton={intl.formatMessage(messages.deletionConfirmationConfirm, { num: itemCount })}
              content={intl.formatMessage(messages.deletionConfirmationContent, { num: itemCount })}
              open={deletionConfirmation}
              onCancel={(): void => handleDeleteQuestions(false)}
              onConfirm={(): void => handleDeleteQuestions(true)}
            />
          </>
        )}
      </div>

      <div className="checkedCounter">
        <Label size="medium">
          <Icon name="thumbtack" />
          <FormattedMessage
            defaultMessage="{count} items checked"
            id="questionPool.string.itemsChecked"
            values={{ count: itemCount }}
          />
        </Label>
      </div>

      {csvData && <CSVDownload data={csvData} />}

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
