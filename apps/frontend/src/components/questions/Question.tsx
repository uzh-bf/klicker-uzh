import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import { FormattedMessage, useIntl } from 'react-intl'
import { useDrag } from 'react-dnd'
import { Checkbox, Button, Label } from 'semantic-ui-react'

import QuestionTags from './QuestionTags'
import QuestionDetailsModal from './QuestionDetailsModal'
import QuestionDuplicationModal from './QuestionDuplicationModal'
import { generateTypesShort } from '../../lib/utils/lang'

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
            'flex flex-row w-full p-3 bg-gray-50 border border-solid rounded-lg md:flex-col',
            draggable && 'cursor-[grab] hover:shadow-md',
            collectedProps.isDragging && 'opacity-50'
          )}
          ref={drag}
        >
          <div className="md:flex-[0_0_auto] md:self-end">
            <QuestionTags tags={tags} type={type} />
          </div>
          <div>
            {isArchived && (
              <Label color="red" size="tiny">
                <FormattedMessage defaultMessage="ARCHIVED" id="questionPool.question.titleArchive" />
              </Label>
            )}{' '}
            <a
              className="text-xl font-bold cursor-pointer text-primary-strong"
              role="button"
              tabIndex={0}
              type="button"
              onClick={() => setIsModificationModalOpen(true)}
              onKeyDown={() => setIsModificationModalOpen(true)}
            >
              {title} ({generateTypesShort(intl)[type]})
            </a>
            <div className="mb-2">{description.length > 200 ? `${description.substring(0, 200)}...` : description}</div>
          </div>

          {/* // TODO: maybe outsource these buttons into separate component */}
          <div className="flex flex-col md:w-full w-max md:flex-row">
            {/* // TODO: create preview button with preview of questions on push - evtl. create previewmodal component */}
            <div className="mb-2 md:flex-1 md:mb-0">
              <Button basic fluid className="!w-36" onClick={(): void => null}>
                <FormattedMessage defaultMessage="Preview" id="questionDetails.button.preview" />
              </Button>
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
