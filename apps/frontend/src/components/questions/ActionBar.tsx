import React, { useEffect, useState } from 'react'
import _sortBy from 'lodash/sortBy'
import dayjs from 'dayjs'
import { saveAs } from 'file-saver'
import { CSVDownload } from 'react-csv'
import { useToasts } from 'react-toast-notifications'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Confirm, Icon, Label, Dropdown, Checkbox } from 'semantic-ui-react'
import { useMutation } from '@apollo/client'

import QuestionCreationModal from './QuestionCreationModal'
import UploadModal from './UploadModal'
import QuestionStatisticsMutation from '../../graphql/mutations/QuestionStatisticsMutation.graphql'
import ExportQuestionsMutation from '../../graphql/mutations/ExportQuestionsMutation.graphql'
import { omitDeep } from '../../lib/utils/omitDeep'

const messages = defineMessages({
  create: {
    defaultMessage: 'Create',
    id: 'questionPool.button.create',
  },
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
  questionView?: string
  deletionConfirmation: boolean
  handleArchiveQuestions: any
  handleCreationModeToggle: any
  handleDeleteQuestions: any
  handleQuickBlock: any
  handleQuickBlocks: any
  handleSetItemsChecked: any
  handleResetItemsChecked: any
  handleQuesionViewChange: any
  isArchiveActive?: boolean
  isViewToggleVisible?: boolean
  itemsChecked?: string[]
  questions?: any[]
}

const defaultProps = {
  creationMode: false,
  questionView: 'list',
  isArchiveActive: false,
  isViewToggleVisible: false,
  itemsChecked: [],
  questions: [],
}

function ActionBar({
  isArchiveActive,
  isViewToggleVisible,
  creationMode,
  questionView,
  deletionConfirmation,
  itemsChecked,
  handleArchiveQuestions,
  handleCreationModeToggle,
  handleDeleteQuestions,
  handleQuickBlock,
  handleQuickBlocks,
  handleSetItemsChecked,
  handleResetItemsChecked,
  handleQuesionViewChange,
  questions,
}: Props): React.ReactElement {
  const intl = useIntl()

  const { addToast } = useToasts()

  const [csvData, setCsvData] = useState([])
  const [allItemsChecked, setAllItemsChecked] = useState(false)
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false)

  const [getQuestionStatistics, { data, error }] = useMutation(QuestionStatisticsMutation)
  const [exportQuestions, { data: exportData, error: exportError }] = useMutation(ExportQuestionsMutation)

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
      addToast(
        <FormattedMessage
          defaultMessage="Unable to export statistics: {errorMessage}"
          id="components.questions.actionBar.data.error"
          values={{ errorMessage: error.message }}
        />,
        { appearance: 'error' }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, error])

  useEffect((): void => {
    if (exportData) {
      const dataWithoutTypename = omitDeep(exportData, '__typename')
      const blob = new Blob([JSON.stringify(dataWithoutTypename)], { type: 'text/plain;charset=utf-8' })
      saveAs(blob, `klicker_export_${dayjs().format('YYYY-MM-DD_H-m-s')}.json`)
    } else if (exportError) {
      addToast(
        <FormattedMessage
          defaultMessage="Unable to export questions: {errorMessage}"
          id="components.questions.actionBar.export.error"
          values={{ errorMessage: error.message }}
        />,
        { appearance: 'error' }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportData, exportError])

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

  const onExportQuestions = async (): Promise<void> => {
    try {
      await exportQuestions({
        variables: { ids: itemsChecked },
      })
    } catch (e) {
      console.error(e.message)
    }
  }

  const onSetAllItemsChecked = (): void => {
    // if all items have been checked, reset selection
    if (allItemsChecked) {
      handleResetItemsChecked()
      setAllItemsChecked(false)
    } else {
      // otherwise, select all items
      handleSetItemsChecked(questions)
      setAllItemsChecked(true)
    }
  }

  const itemCount = itemsChecked.length

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap md:items-center md:justify-between actionBar md:max-w-7xl md:m-auto">
      <div className="flex flex-col flex-1 md:flex-00auto md:flex-row md:order-3">
        <Dropdown
          button
          labeled
          className="primary icon !mr-0"
          direction="left"
          disabled={isAnyModalOpen}
          icon="plus square"
          text={intl.formatMessage(messages.create)}
        >
          <Dropdown.Menu>
            <Dropdown.Item disabled={!!creationMode} onClick={handleCreationModeToggle}>
              <Icon name="play" />
              <FormattedMessage defaultMessage="New Session" id="questionPool.button.createSession" />
            </Dropdown.Item>
            <QuestionCreationModal handleModalOpenChange={setIsAnyModalOpen}>
              {({ setIsModalOpen }): any => (
                <Dropdown.Item onClick={(): void => setIsModalOpen(true)}>
                  <Icon name="question circle" />
                  <FormattedMessage defaultMessage="New Question" id="questionPool.button.createQuestion" />
                </Dropdown.Item>
              )}
            </QuestionCreationModal>
            <UploadModal>
              <Dropdown.Item>
                <Icon name="upload" />
                <FormattedMessage defaultMessage="Questions via Import" id="questionPool.button.importQuestions" />
              </Dropdown.Item>
            </UploadModal>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      <div className="flex flex-col flex-1 md:order-2 md:flex-00auto md:flex-row">
        {creationMode && (
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
        )}
      </div>

      <div className="flex items-center">
        <Dropdown button className="icon" direction="right" disabled={itemCount === 0} icon="wrench">
          <Dropdown.Menu>
            <Dropdown.Item icon labelPosition="left" size="small" onClick={onExportQuestions}>
              <Icon name="download" />
              <FormattedMessage defaultMessage="Export (JSON)" id="questionPool.button.exportQuestions" />
            </Dropdown.Item>

            <Dropdown.Item icon labelPosition="left" size="small" onClick={onGetQuestionStatistics}>
              <Icon name="calculator" />
              <FormattedMessage defaultMessage="Statistics (CSV)" id="questionPool.button.computeStatistics" />
            </Dropdown.Item>

            <Dropdown.Item icon labelPosition="left" size="small" onClick={(): void => handleArchiveQuestions()}>
              <Icon name="archive" />
              {isArchiveActive ? (
                <FormattedMessage defaultMessage="Unarchive" id="questionPool.button.unarchiveQuestions" />
              ) : (
                <FormattedMessage defaultMessage="Archive" id="questionPool.button.archiveQuestions" />
              )}
            </Dropdown.Item>

            <Dropdown.Item icon labelPosition="left" size="small" onClick={(): void => handleDeleteQuestions(false)}>
              <Icon name="trash" />
              <FormattedMessage defaultMessage="Delete" id="questionPool.button.deleteQuestions" />
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

        <Label className="!flex !items-center !h-[36px]">
          <Checkbox
            checked={allItemsChecked}
            className="!mr-2"
            indeterminate={!allItemsChecked && itemsChecked.length > 0}
            onChange={(): void => onSetAllItemsChecked()}
          />
          <span>
            <FormattedMessage
              defaultMessage="{count} items checked"
              id="questionPool.string.itemsChecked"
              values={{ count: itemCount }}
            />
          </span>
        </Label>

        {/* buttons to change between question view formats */}
        {isViewToggleVisible && (
          <div className="ml-1">
            <Button.Group className="order-1">
              <Button icon active={questionView === 'list'} onClick={(): void => handleQuesionViewChange('list')}>
                <Icon name="list" />
              </Button>
              <Button icon active={questionView === 'grid'} onClick={(): void => handleQuesionViewChange('grid')}>
                <Icon name="grid layout" />
              </Button>
            </Button.Group>
          </div>
        )}

        <Confirm
          cancelButton={intl.formatMessage(messages.deletionConfirmationCancel)}
          confirmButton={intl.formatMessage(messages.deletionConfirmationConfirm, { num: itemCount })}
          content={intl.formatMessage(messages.deletionConfirmationContent, { num: itemCount })}
          open={deletionConfirmation}
          onCancel={(): void => handleDeleteQuestions(false)}
          onConfirm={(): void => handleDeleteQuestions(true)}
        />
      </div>

      {csvData?.length > 0 && <CSVDownload data={csvData} />}
    </div>
  )
}

ActionBar.defaultProps = defaultProps

export default ActionBar
