import React, { useState } from 'react'
import clsx from 'clsx'
import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { useDrag } from 'react-dnd'
import { Checkbox, Dropdown, Label } from 'semantic-ui-react'
import { generateTypesShort } from '../../lib/utils/lang'
import { useIntl } from 'react-intl'

import QuestionDetails from './QuestionDetails'
import QuestionTags from './QuestionTags'

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

  return (
    <div
      className={clsx('question', {
        creationMode,
        draggable: creationMode,
        isArchived,
        isDragging: collectedProps.isDragging,
      })}
      ref={drag}
    >
      <div className="p-4 border border-gray-400 border-2 border-solid p-6 bg-gray-100 rounded-lg h-full">
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
        {/*<div className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-indigo-100 text-indigo-500">
          <svg
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            className="w-6 h-6"
            viewBox="0 0 24 24"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          </div>*/}
        <h2 className="title">{title}</h2>
        <p className="leading-relaxed text-base clampedDescription">{description}</p>
      </div>
      <style jsx>{`
        .clampedDescription {
          overflow: hidden;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
        }
      `}</style>
      {/*<div className={clsx('checker', { active: !draggable })}>
        <Checkbox
          checked={checked}
          id={`check-${id}`}
          type="checkbox"
          onClick={(): void => onCheck({ version: activeVersion })}
        />
      </div>
      <div className="wrapper items-center">
        <h2 className="title">
          {isArchived && (
            <Label color="red" size="tiny">
              <FormattedMessage defaultMessage="ARCHIVED" id="questionPool.question.titleArchive" />
            </Label>
          )}{' '}
          {title}
        </h2>

        <div className="versionChooser">
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
        </div>

        <div className="tags">
          <QuestionTags tags={tags} type={type} />
        </div>


          </div>*/}
    </div>
  )
}

QuestionCompact.defaultProps = defaultProps

export default QuestionCompact
