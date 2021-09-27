import React, { useState } from 'react'
import clsx from 'clsx'
//import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { useDrag } from 'react-dnd'
import { Button } from 'semantic-ui-react'
import { generateTypesShort } from '../../lib/utils/lang'
import { useIntl } from 'react-intl'
import QuestionDetailsModal from './QuestionDetailsModal'
import QuestionDuplicationModal from './QuestionDuplicationModal'

interface Props {
  checked?: boolean
  creationMode?: boolean
  id: string
  isArchived: boolean
  lastUsed?: any[]
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

function QuestionCompact({
  checked,
  id,
  lastUsed,
  tags,
  title,
  type,
  versions,
  onCheck,
  draggable,
  creationMode,
  isArchived,
}: Props): React.ReactElement {
  const activeVersion = versions.length - 1
  const { description } = versions[activeVersion]
  const intl = useIntl()
  const [isDuplicationModalOpen, setIsDuplicationModalOpen] = useState(false)
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false)
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

  return (
    <div
      className={clsx(
        'question',
        {
          creationMode,
          draggable: creationMode,
          isArchived,
          isDragging: collectedProps.isDragging,
        },
        'relative'
      )}
      ref={drag}
    >
      <div
        className={clsx(
          checked && '!bg-green-100',
          creationMode && '!cursor-[grab]',
          collectedProps.isDragging && '!cursor-[grabbing]',
          'p-4 border border-gray-400 border-2 border-solid p-6 bg-gray-100 rounded-lg h-full cursor-pointer'
        )}
        onClick={(): void => onCheck({ version: activeVersion })}
      >
        <div className="mb-14">
          <div className="text-right">
            {tags.map((tag: any) => (
              <div className="p-2 bg-blue-100 rounded-md w-min float-right ml-2">{tag.name}</div>
            ))}
          </div>
          <div className="absolute text-left bg-blue-200 p-2 rounded-md w-min float-left font-bold">
            {generateTypesShort(intl)[type]}
          </div>
        </div>

        <h2 className="title">{title}</h2>
        <p className="leading-relaxed text-base clampedDescription mb-16">{description}</p>
        <div className="absolute bottom-0 w-full pl-6 pr-8 -ml-6 ">
          <div className="border-0 border-b-2 border-solid border-gray-300 mb-4" />
          <div className="float-right mb-4">
            <Button onClick={(): void => setIsModificationModalOpen(true)}>
              <FormattedMessage defaultMessage="View / Edit" id="questionDetails.button.edit" />
            </Button>
            {isModificationModalOpen && (
              <QuestionDetailsModal
                handleSetIsOpen={setIsModificationModalOpen}
                isOpen={isModificationModalOpen}
                questionId={id}
              />
            )}

            <Button onClick={(): void => setIsDuplicationModalOpen(true)}>
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
      <style jsx>{`
        .clampedDescription {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
      `}</style>
    </div>
  )
}

QuestionCompact.defaultProps = defaultProps

export default QuestionCompact
