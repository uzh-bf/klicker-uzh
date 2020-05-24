import React, { useState } from 'react'
import classNames from 'classnames'
import dayjs from 'dayjs'
import { FormattedMessage } from 'react-intl'
import { useDrag } from 'react-dnd'
import { Checkbox, Dropdown, Label } from 'semantic-ui-react'

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
  creationMode,
  isArchived,
}: Props): React.ReactElement {
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

  return (
    <div
      className={classNames('question', {
        creationMode,
        draggable: creationMode,
        isArchived,
        isDragging: collectedProps.isDragging,
      })}
      ref={drag}
    >
      <div className={classNames('checker', { active: !draggable })}>
        <Checkbox
          checked={checked}
          id={`check-${id}`}
          type="checkbox"
          onClick={(): void => onCheck({ version: activeVersion })}
        />
      </div>

      <div className="wrapper">
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

        <div className="details">
          <QuestionDetails description={description} lastUsed={lastUsed} questionId={id} />
        </div>
      </div>

      <style jsx>{`
        @import 'src/theme';

        .question {
          display: flex;
          flex-flow: column nowrap;

          padding: 0.5rem;
          border: 1px solid gainsboro;
          background-color: #f9f9f9;

          &.draggable {
            cursor: grab;

            &:hover {
              box-shadow: 0 6px 10px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.1);
            }
          }

          &.isDragging {
            opacity: 0.5;
          }

          .checker {
            flex: 0 0 auto;
            display: flex;

            align-self: center;

            padding: 0.5rem;
            padding-left: 0;
          }

          .wrapper {
            display: flex;
            flex-flow: column nowrap;

            .title {
              color: $color-primary-strong;
              font-size: $font-size-h1;
              margin: 0;
              margin-top: 0.2rem;
            }
          }

          @include desktop-tablet-only {
            flex-flow: row wrap;

            .checker {
              flex: 0 0 1rem;
              display: flex;
              align-items: center;

              padding: 1rem;
              padding-left: 0.5rem;
            }

            .wrapper {
              flex: 1;
              flex-flow: row wrap;

              .title {
                flex: 0 0 auto;
              }

              .versionChooser {
                flex: 1 1 auto;
                padding-right: 1rem;
                text-align: right;
                align-self: center;
              }

              .tags {
                flex: 0 0 auto;
                align-self: flex-end;
              }

              .details {
                flex: 0 0 100%;
              }
            }
          }
        }
      `}</style>
    </div>
  )
}

Question.defaultProps = defaultProps

export default Question
