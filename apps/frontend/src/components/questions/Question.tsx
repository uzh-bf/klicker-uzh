import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { useDrag } from 'react-dnd'
import { Checkbox, Dropdown, Label } from 'semantic-ui-react'

import QuestionDetails from './QuestionDetails'
import QuestionTags from './QuestionTags'

interface Props {
  checked?: boolean
  id: string
  isArchived?: boolean
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

function Question({
  checked,
  id,
  lastUsed,
  tags,
  title,
  type,
  versions,
  onCheck,
  draggable,
  isArchived,
}: Props): React.ReactElement {
  const [isModificationModalOpen, setIsModificationModalOpen] = useState(false)

  const [activeVersion, setActiveVersion]: any = useState(versions.length - 1)
  const { description } = versions[activeVersion]
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
    <div
      className={clsx(
        'question rounded border border-solid border-gray-300 bg-gray-50 flex flex-col flex-nowrap p-2 mb-4 md:flex-row md:flex-wrap',
        draggable && 'cursor-[grab] hover:shadow-md',
        collectedProps.isDragging && 'opacity-50'
      )}
      ref={drag}
    >
      <div
        className={clsx('md:p-4 md:pl-2 md:flex md:items-center p-2 pl-0 self-center flex flex-[0_0_auto]', {
          active: !draggable,
        })}
      >
        <Checkbox
          checked={checked}
          id={`check-${id}`}
          type="checkbox"
          onClick={(): void => onCheck({ version: activeVersion })}
        />
      </div>

      <div className="flex flex-col md:flex-1 md:flex-row md:flex-wrap flex-nowrap">
        <h2 className="m-0 !mt-1 flex-[0_0_auto] text-2xl text-primary-strong">
          {isArchived && (
            <Label color="red" size="tiny">
              <FormattedMessage defaultMessage="ARCHIVED" id="questionPool.question.titleArchive" />
            </Label>
          )}{' '}
          <a
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            type="button"
            onClick={() => setIsModificationModalOpen(true)}
            onKeyDown={() => setIsModificationModalOpen(true)}
          >
            {title}
          </a>
        </h2>

        <div className="md:flex-auto md:pr-4 md:text-right md:self-center">
          {versions.length > 1 && (
            <Dropdown
              disabled={versions.length === 1}
              options={versions.map((version, index): any => ({
                key: index,
                text: `v${index + 1} - ${dayjs(version.createdAt).format('DD.MM.YYYY HH:mm')}`,
                value: index,
              }))}
              value={activeVersion}
              onChange={(_, data): void => setActiveVersion(data.value)}
            />
          )}
        </div>

        <div className="md:flex-[0_0_auto] md:self-end">
          <QuestionTags tags={tags} type={type} />
        </div>

        <div className="md:flex-[0_0_100%]">
          <QuestionDetails
            description={description}
            isModificationModalOpen={isModificationModalOpen}
            lastUsed={lastUsed}
            questionId={id}
            setIsModificationModalOpen={setIsModificationModalOpen}
          />
        </div>
      </div>
    </div>
  )
}

Question.defaultProps = defaultProps

export default Question
