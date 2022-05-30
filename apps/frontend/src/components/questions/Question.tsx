import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import { FormattedMessage, useIntl } from 'react-intl'
import { useDrag } from 'react-dnd'
import { Checkbox, Button, Label } from 'semantic-ui-react'

import QuestionTags from './QuestionTags'
import QuestionPreviewModal from './QuestionPreviewModal'
import QuestionDetailsModal from './QuestionDetailsModal'
import QuestionDuplicationModal from './QuestionDuplicationModal'
import { generateTypesLabel } from '../../lib/utils/lang'

interface Props {
  checked?: boolean
  id: string
  isArchived?: boolean
  tags?: any[]
  title: string
  type: string
  versions: any[]
  draggable: boolean
  onCheck: any
}

const defaultProps = {
  checked: false,
  creationMode: false,
  isArchived: false,
  lastUsed: [],
  tags: [],
}

function Question({
  checked,
  id,
  tags,
  title,
  type,
  versions,
  onCheck,
  draggable,
  isArchived,
}: Props): React.ReactElement {
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
          <Checkbox
            checked={checked}
            id={`check-${id}`}
            type="checkbox"
            onClick={(): void => onCheck({ version: activeVersion })}
          />
        </div>
        <div
          className={clsx(
            'flex flex-row w-full p-3 bg-grey-20 border border-solid rounded-lg md:flex-col',
            draggable && 'cursor-[grab] hover:shadow-md',
            collectedProps.isDragging && 'opacity-50'
          )}
          ref={drag}
        >
          <div className="flex flex-row">
            <div className="flex-1">
              {isArchived && (
                <Label color="red" size="tiny">
                  <FormattedMessage defaultMessage="ARCHIVED" id="questionPool.question.titleArchive" />
                </Label>
              )}{' '}
              <a
                className="flex-1 mr-10 text-xl font-bold cursor-pointer text-primary-strong"
                role="button"
                tabIndex={0}
                type="button"
                onClick={() => setIsModificationModalOpen(true)}
                onKeyDown={() => setIsModificationModalOpen(true)}
              >
                {title}
              </a>
              <div className="mb-2 italic">{generateTypesLabel(intl)[type]}</div>
            </div>
            <div className="w-max">
              <QuestionTags tags={tags} />
            </div>
          </div>

          <div className="mb-2">{description.length > 200 ? `${description.substring(0, 200)}...` : description}</div>

          {/* // TODO: maybe outsource these buttons into separate component */}
          <div className="flex flex-col md:w-full w-max md:flex-row">
            {/* // TODO: improve and style preview component, maybe create preview with mobile phone background? */}
            <div className="mb-2 md:flex-1 md:mb-0">
              <Button basic fluid className="!w-36" onClick={(): void => setIsPreviewModalOpen(true)}>
                <FormattedMessage defaultMessage="Preview" id="questionDetails.button.preview" />
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
            {/* // TODO: restyle buttons, etc. */}
            <div className="mb-2 md:mr-3 w-36 md:mb-0">
              <Button basic fluid onClick={(): void => setIsModificationModalOpen(true)}>
                <FormattedMessage defaultMessage="View / Edit" id="questionDetails.button.edit" />
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
              <Button basic fluid onClick={(): void => setIsDuplicationModalOpen(true)}>
                <FormattedMessage defaultMessage="Duplicate" id="questionDetails.button.duplicate" />
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
