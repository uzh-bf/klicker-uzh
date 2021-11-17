import React from 'react'
import { Icon } from 'semantic-ui-react'
import { useIntl } from 'react-intl'

import Ellipsis from '../common/Ellipsis'
import { generateTypesShort } from '../../lib/utils/lang'
import CustomTooltip from '../common/CustomTooltip'

interface Props {
  hasParticipantCount?: boolean
  id?: string
  isSessionRunning?: boolean
  description?: string
  onDelete?: () => void
  title: string
  totalParticipants?: number
  type: string
  version?: number
}

const defaultProps = {
  hasParticipantCount: true,
  onDelete: undefined,
  totalParticipants: -1,
  version: 0,
}

function QuestionSingle({
  hasParticipantCount,
  id,
  description,
  type,
  title,
  totalParticipants,
  version,
  onDelete,
}: Props): React.ReactElement {
  const intl = useIntl()

  return (
    <div data-tip className="questionSingle border-primary bg-primary-bg" data-for={`questionTooltip${id}`}>
      {id && description && onDelete && (
        <CustomTooltip
          content={<span>{description}</span>}
          iconObject={
            <div>
              <div className="top bg-primary-20">
                <div className="type">{generateTypesShort(intl)[type]}</div>
                <button className="ui basic icon button deleteButton" type="button" onClick={onDelete}>
                  <Icon name="trash" />
                </button>
              </div>
              <div className="title text-primary-strong">
                <Ellipsis>{title}</Ellipsis>
                {version >= 0 && <span> {`(v${version + 1})`}</span>}
              </div>
            </div>
          }
        />
      )}

      {!(id && description && onDelete) && (
        <>
          <div className="top bg-primary-20">
            <div className="type">{generateTypesShort(intl)[type]}</div>

            {onDelete && (
              <button className="ui basic icon button deleteButton" type="button" onClick={onDelete}>
                <Icon name="trash" />
              </button>
            )}

            {hasParticipantCount && totalParticipants >= 0 && (
              <div className="responseCount">
                <Icon name="user outline" />
                {totalParticipants}
              </div>
            )}
          </div>

          <div className="title text-primary-strong">
            <Ellipsis>{title}</Ellipsis>
            {version >= 0 && <span> {`(v${version + 1})`}</span>}
          </div>
        </>
      )}

      <style jsx>
        {`
          .questionSingle {
            .top,
            .title {
              padding: 0.3rem;
            }

            .top {
              display: flex;
              justify-content: space-between;
              text-align: center;

              .type {
                font-weight: bold;
              }

              .deleteButton {
                padding: 3px;
                margin: 0;
              }
            }

            .title {
              line-break: loose;
              text-align: center;
            }
          }
        `}
      </style>
    </div>
  )
}

QuestionSingle.defaultProps = defaultProps

export default QuestionSingle
