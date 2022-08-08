import { CheckIcon } from '@heroicons/react/outline'
import { Button } from '@uzh-bf/design-system'
import React, { useEffect, useState } from 'react'
import { useDrag } from 'react-dnd'
import { FormattedMessage, useIntl } from 'react-intl'
import { Label } from 'semantic-ui-react'
import { twMerge } from 'tailwind-merge'

import { generateTypesLabel } from '../../lib/utils/lang'
import CustomCheckbox from '../common/CustomCheckbox'
import QuestionDetailsModal from './QuestionDetailsModal'
import QuestionDuplicationModal from './QuestionDuplicationModal'
import QuestionPreviewModal from './QuestionPreviewModal'
import QuestionTags from './QuestionTags'

interface Props {
  checked?: boolean
  id: string
  isArchived?: boolean
  tags?: any[]
  title: string
  type: string
  versions: any[]
  onCheck: any
}

const defaultProps = {
  checked: false,
  isArchived: false,
  lastUsed: [],
  tags: [],
}

function Question({ checked, id, tags, title, type, versions, onCheck, isArchived }: Props): React.ReactElement {
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false)
  const [isDuplicationModalOpen, setIsDuplicationModalOpen] = useState(false)
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
  const [activeVersion, setActiveVersion]: any = useState(versions.length - 1)
  const { description } = versions[activeVersion]
  const intl = useIntl()

  const [collectedProps, drag] = useDrag({
    item: {
      id,
      type: 'question',
      questionType: type,
      title,
      version: activeVersion,
      description,
    },
    collect: (monitor): any => ({
      isDragging: monitor.isDragging(),
    }),
    type: 'question',
  })

  useEffect(() => {
    setActiveVersion(versions.length - 1)
  }, [versions])

  return (
    <>
      <div className="flex w-full mb-4 h-max flex-col-2">
        <div className="min-h-full my-auto mr-2">
          <CustomCheckbox checked={checked} id={id} onCheck={() => onCheck({ version: activeVersion })}>
            <CheckIcon />
          </CustomCheckbox>
        </div>
        <div
          className={twMerge(
            'flex flex-row w-full p-3 bg-grey-20 border border-solid rounded-lg md:flex-col cursor-[grab] hover:shadow-md',
            collectedProps.isDragging && 'opacity-50'
          )}
          ref={drag}
        >
          <div className="flex flex-row flex-1">
            <div className="flex-1">
              {isArchived && (
                <Label color="red" size="tiny">
                  <FormattedMessage defaultMessage="ARCHIVED" id="questionPool.question.titleArchive" />
                </Label>
              )}{' '}
              <a
                className="flex-1 text-xl font-bold cursor-pointer text-primary-strong"
                role="button"
                tabIndex={0}
                type="button"
                onClick={() => setIsModificationModalOpen(true)}
                onKeyDown={() => setIsModificationModalOpen(true)}
              >
                {title}
              </a>
              <div className="mb-2 italic">{generateTypesLabel(intl)[type]}</div>
              <div className="flex-1 mb-2">
                {description.length > 120 ? `${description.substring(0, 120)}...` : description}
              </div>
            </div>
            <div className="hidden ml-6 w-max md:block">
              <QuestionTags tags={tags} />
            </div>
          </div>

          <div className="flex flex-col md:w-full w-max md:flex-row">
            <div className="mb-2 md:flex-1 md:mb-0">
              <Button className="justify-center h-10 bg-white w-36" onClick={(): void => setIsPreviewModalOpen(true)}>
                <Button.Label>
                  <FormattedMessage defaultMessage="Preview" id="questionDetails.button.preview" />
                </Button.Label>
              </Button>
              {isPreviewModalOpen && (
                <QuestionPreviewModal
                  handleSetIsOpen={setIsPreviewModalOpen}
                  isOpen={isPreviewModalOpen}
                  question={versions[activeVersion]}
                  type={type}
                />
              )}
            </div>
            <div className="mb-2 md:mr-3 w-36 md:mb-0">
              <Button
                className="justify-center h-10 bg-white w-36"
                onClick={(): void => setIsModificationModalOpen(true)}
              >
                <Button.Label>
                  <FormattedMessage defaultMessage="View / Edit" id="questionDetails.button.edit" />
                </Button.Label>
              </Button>
              {isModificationModalOpen && (
                <QuestionDetailsModal
                  handleSetIsOpen={setIsModificationModalOpen}
                  isOpen={isModificationModalOpen}
                  questionId={id}
                />
              )}
            </div>
            <div className="w-36">
              <Button
                className="justify-center h-10 bg-white w-36"
                onClick={(): void => setIsDuplicationModalOpen(true)}
              >
                <Button.Label>
                  <FormattedMessage defaultMessage="Duplicate" id="questionDetails.button.duplicate" />
                </Button.Label>
              </Button>
              {isDuplicationModalOpen && (
                <QuestionDuplicationModal
                  handleSetIsOpen={setIsDuplicationModalOpen}
                  isOpen={isDuplicationModalOpen}
                  questionId={id}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

Question.defaultProps = defaultProps

export default Question
