import React, { useEffect, useState } from 'react'
import _sortBy from 'lodash/sortBy'
import dayjs from 'dayjs'
import { saveAs } from 'file-saver'
import { CSVDownload } from 'react-csv'
import { useToasts } from 'react-toast-notifications'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Confirm, Icon } from 'semantic-ui-react'
import { useMutation } from '@apollo/client'
import { PlusCircleIcon, CheckIcon, MinusSmIcon } from '@heroicons/react/outline'
import { ChevronDownIcon } from '@heroicons/react/solid'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArchive,
  faArrowDownWideShort,
  faArrowUpWideShort,
  faBoltLightning,
  faCalculator,
  faDownload,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import clsx from 'clsx'

import QuestionCreationModal from './QuestionCreationModal'
import UploadModal from './UploadModal'
import QuestionStatisticsMutation from '../../graphql/mutations/QuestionStatisticsMutation.graphql'
import ExportQuestionsMutation from '../../graphql/mutations/ExportQuestionsMutation.graphql'
import { omitDeep } from '../../lib/utils/omitDeep'
import CustomTooltip from '../common/CustomTooltip'
import CustomCheckbox from '../common/CustomCheckbox'
import SearchField from '../common/SearchField'

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
  searchPlaceholder: {
    defaultMessage: 'Search...',
    id: 'common.input.search.placeholder',
  },
})

interface Props {
  deletionConfirmation: boolean
  handleArchiveQuestions: any
  handleDeleteQuestions: any
  handleQuickBlock: any
  handleQuickBlocks: any
  setSessionBlocks: any
  isArchiveActive?: boolean
  itemsChecked?: string[]
  handleSearch: any
  handleSortByChange: any
  handleSortOrderToggle: any
  handleQuickStart: any
  runningSessionId: string | undefined
  sortBy: string
  sortingTypes: {
    content: string
    id: string
    labelStart: string
  }[]
  sortOrder: boolean
  withSorting?: boolean
  handleSetItemsChecked?: any
  handleResetItemsChecked?: any
  questions?: any[]
  sessionBlocks: any[]
}

const defaultProps = {
  isArchiveActive: false,
  itemsChecked: [],
  withSorting: false,
  questions: [],
  handleSetItemsChecked: undefined,
  handleResetItemsChecked: undefined,
}

function ActionSearchArea({
  isArchiveActive,
  deletionConfirmation,
  itemsChecked,
  handleArchiveQuestions,
  handleDeleteQuestions,
  handleQuickBlock,
  handleQuickBlocks,
  setSessionBlocks,
  handleSearch,
  handleSortByChange,
  handleSortOrderToggle,
  handleQuickStart,
  runningSessionId,
  sortBy,
  sortingTypes,
  sortOrder,
  withSorting,
  handleSetItemsChecked,
  handleResetItemsChecked,
  questions,
  sessionBlocks,
}: Props): React.ReactElement {
  const intl = useIntl()

  const { addToast } = useToasts()

  const [csvData, setCsvData] = useState([])
  const [creationModalOpen, setCreationModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [createDropdownOpen, setCreateDropdownOpen] = useState(false)
  const [allItemsChecked, setAllItemsChecked] = useState(false)

  const [getQuestionStatistics, { data, error }] = useMutation(QuestionStatisticsMutation)
  const [exportQuestions, { data: exportData, error: exportError }] = useMutation(ExportQuestionsMutation)

  const itemCount = itemsChecked.length
  const [previousSessionBlocks, setPreviousSessionBlocks] = useState([])

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

  const getCheckboxState = (allItems, numOfItems) => {
    if (allItems || numOfItems === questions.length) {
      return true
    }
    if (numOfItems > 0) {
      return 'indeterminate'
    }
    return false
  }

  const onSetAllItemsChecked = (): void => {
    // if all items have been checked, reset selection
    if (allItemsChecked) {
      handleResetItemsChecked()
    } else {
      // otherwise, select all items
      handleSetItemsChecked(questions)
    }
  }

  useEffect(() => {
    if (itemCount === questions.length) {
      setAllItemsChecked(true)
    } else {
      setAllItemsChecked(false)
    }
  }, [itemCount, questions.length])

  return (
    <div className="w-full">
      <div className="flex flex-col w-full md:flex-row md:flex-wrap md:items-center md:justify-between md:m-auto">
        <div className="flex flex-col flex-1 md:flex-[0_0_auto] md:flex-row md:order-3">
          <DropdownMenu.Root open={createDropdownOpen} onOpenChange={setCreateDropdownOpen}>
            <DropdownMenu.Trigger className="flex flex-row w-36 pl-7 text-left border-0 rounded-md bg-sky-600 hover:bg-sky-700 hover:cursor-pointer h-[36px]">
              <div className="flex-1 py-2.5 flex flex-row -mt-[0.04rem]">
                <PlusCircleIcon className="mr-3 -mt-[0.23rem] -ml-1 font-bold text-white h-7" />
                <div className="font-bold text-white">Create</div>
              </div>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content className="flex flex-col px-2 bg-white border border-solid rounded-md border-grey-80">
              <DropdownMenu.Item
                className="[all:_unset] w-50 hover:bg-blue-20 bg-white align-middle !px-4 !py-1 !rounded-md !my-1 hover:cursor-pointer"
                key="questionCreation"
                onClick={() => {
                  setCreateDropdownOpen(false)
                  setCreationModalOpen(true)
                }}
              >
                <Icon name="question circle" />
                <FormattedMessage defaultMessage="New Question" id="questionPool.button.createQuestion" />
              </DropdownMenu.Item>
              <div className="h-[0.075rem] bg-grey-80 opacity-40" />

              <DropdownMenu.Item
                className="[all:_unset] w-50 hover:bg-blue-20 bg-white align-middle !px-4 !py-1 !rounded-md !my-1 hover:cursor-pointer"
                key="uploadmodal"
                onClick={() => {
                  setUploadModalOpen(true)
                  setCreateDropdownOpen(false)
                }}
              >
                <Icon name="upload" />
                <FormattedMessage defaultMessage="Questions via Import" id="questionPool.button.importQuestions" />
              </DropdownMenu.Item>
              <DropdownMenu.Arrow className="fill-gray-400" />
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>

        <QuestionCreationModal
          open={creationModalOpen}
          onModalClose={() => {
            setCreationModalOpen(false)
          }}
        />
        <UploadModal className="" open={uploadModalOpen} setOpen={setUploadModalOpen} />

        <div className="flex flex-col flex-1 md:order-2 md:flex-[0_0_auto] md:flex-row">
          <Button
            className="h-10 mr-2 bg-grey-20 hover:bg-grey-40 disabled:!bg-grey-20"
            disabled={itemCount <= 1}
            onClick={(): void => handleQuickBlocks(true)}
            onMouseEnter={(): void => {
              if (itemCount > 1) {
                setPreviousSessionBlocks(sessionBlocks)
                handleQuickBlocks(false)
              }
            }}
            onMouseLeave={(): void => {
              if (itemCount > 1) {
                setSessionBlocks(previousSessionBlocks)
              }
            }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faBoltLightning} />
            </Button.Icon>
            <Button.Label>
              <FormattedMessage
                defaultMessage="Split questions into {num} blocks"
                id="questionPool.button.quickCreateSeparate"
                values={{ num: itemCount }}
              />
            </Button.Label>
          </Button>
          <Button
            className="h-10 mr-2 bg-grey-20 hover:bg-grey-40 disabled:!bg-grey-20"
            disabled={itemCount === 0}
            onClick={(): void => handleQuickBlock(true)}
            onMouseEnter={(): void => {
              if (itemCount > 0) {
                setPreviousSessionBlocks(sessionBlocks)
                handleQuickBlock(false)
              }
            }}
            onMouseLeave={(): void => {
              if (itemCount > 0) {
                setSessionBlocks(previousSessionBlocks)
              }
            }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faBoltLightning} />
            </Button.Icon>
            <Button.Label>
              <FormattedMessage
                defaultMessage="Group questions into one block ({num}->1)"
                id="questionPool.button.quickCreateSingle"
                values={{ num: itemCount }}
              />
            </Button.Label>
          </Button>
          {console.log(runningSessionId)}
          {console.log(itemCount === 0 || runningSessionId !== null)}
          <Button
            className="h-10 text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-80 disabled:hover:bg-sky-600"
            disabled={itemCount === 0 || runningSessionId !== null}
            onClick={async (): Promise<void> => handleQuickStart()}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faBoltLightning} />
            </Button.Icon>
            <Button.Label>
              <FormattedMessage
                defaultMessage="Quick Start Session"
                id="questionPool.button.quickStartSession"
                values={{ num: itemCount }}
              />
            </Button.Label>
          </Button>
        </div>

        <div className="flex items-center">
          <CustomTooltip
            tooltip={<FormattedMessage defaultMessage="Export (JSON)" id="questionPool.button.exportQuestions" />}
          >
            <Button
              className={clsx('mr-1 h-10 w-10 justify-center disabled:shadow-none')}
              disabled={itemCount === 0}
              onClick={onExportQuestions}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faDownload} size="lg" />
              </Button.Icon>
            </Button>
          </CustomTooltip>
          <CustomTooltip
            tooltip={<FormattedMessage defaultMessage="Statistics (CSV)" id="questionPool.button.computeStatistics" />}
          >
            <Button
              className={clsx('mr-1 h-10 w-10 justify-center disabled:!shadow-none')}
              disabled={itemCount === 0}
              onClick={onGetQuestionStatistics}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faCalculator} size="lg" />
              </Button.Icon>
            </Button>
          </CustomTooltip>
          <CustomTooltip
            tooltip={
              isArchiveActive ? (
                <FormattedMessage defaultMessage="Unarchive" id="questionPool.button.unarchiveQuestions" />
              ) : (
                <FormattedMessage defaultMessage="Archive" id="questionPool.button.archiveQuestions" />
              )
            }
          >
            <Button
              className={clsx('mr-1 h-10 w-10 justify-center disabled:!shadow-none')}
              disabled={itemCount === 0}
              onClick={(): void => handleArchiveQuestions()}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faArchive} size="lg" />
              </Button.Icon>
            </Button>
          </CustomTooltip>
          <CustomTooltip
            tooltip={<FormattedMessage defaultMessage="Delete" id="questionPool.button.deleteQuestions" />}
          >
            <Button
              className={clsx('mr-1 h-10 w-10 justify-center disabled:!shadow-none')}
              disabled={itemCount === 0}
              onClick={(): void => handleDeleteQuestions(false)}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faTrash} size="lg" />
              </Button.Icon>
            </Button>
          </CustomTooltip>

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
      <div className="flex mt-2 flex-start">
        {itemsChecked && handleSetItemsChecked && handleResetItemsChecked && (
          <CustomCheckbox
            checked={getCheckboxState(allItemsChecked, itemCount)}
            className="my-auto mr-2"
            id={'checkedCounter'}
            onCheck={(): void => onSetAllItemsChecked()}
          >
            {getCheckboxState(allItemsChecked, itemCount) === true ? <CheckIcon /> : null}
            {getCheckboxState(allItemsChecked, itemCount) === 'indeterminate' ? <MinusSmIcon /> : null}
          </CustomCheckbox>
        )}
        <SearchField handleSearch={handleSearch} />

        {withSorting && (
          <>
            <Button className="justify-center mr-1 bg-white w-11 h-11" disabled={false} onClick={handleSortOrderToggle}>
              {sortOrder ? (
                <Button.Icon>
                  <FontAwesomeIcon icon={faArrowDownWideShort} size="lg" />
                </Button.Icon>
              ) : (
                <Button.Icon>
                  <FontAwesomeIcon icon={faArrowUpWideShort} size="lg" />
                </Button.Icon>
              )}
            </Button>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="flex flex-row pl-5 text-left bg-white border border-solid rounded-md w-44 h-11 border-grey-80 hover:cursor-pointer">
                <div className="flex-1 h-full py-2.5">{sortingTypes.find((type) => type.id === sortBy).content}</div>
                <ChevronDownIcon className="w-5 mr-2" />
              </DropdownMenu.Trigger>

              <DropdownMenu.Content className="flex flex-col px-2 bg-white border border-solid rounded-md border-grey-80">
                {sortingTypes.map(({ content, id }, index): any => (
                  <>
                    <DropdownMenu.Item
                      className="[all:_unset] w-50 hover:bg-blue-20 bg-white align-middle !px-6 !py-1 !rounded-md !my-1 hover:cursor-pointer"
                      key={content}
                      onClick={() => handleSortByChange(id)}
                    >
                      <span className={clsx(sortBy === id && 'font-bold', 'text-lg')}>{content}</span>
                    </DropdownMenu.Item>
                    <div
                      className={clsx(
                        'h-[0.075rem] bg-grey-80 opacity-40',
                        sortingTypes.length - 1 === index && 'hidden'
                      )}
                      key={content}
                    />
                  </>
                ))}

                <DropdownMenu.Arrow className="fill-gray-400" />
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </>
        )}
      </div>
    </div>
  )
}

ActionSearchArea.defaultProps = defaultProps
export default ActionSearchArea
