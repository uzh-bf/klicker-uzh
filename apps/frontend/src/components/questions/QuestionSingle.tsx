import React from 'react'
import { useIntl } from 'react-intl'
import { Icon } from 'semantic-ui-react'

import { generateTypesShort } from '../../lib/utils/lang'
import Ellipsis from '../common/Ellipsis'

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
    <div
      data-tip
      className="border border-solid rounded shadow border-primary bg-primary-bg"
      data-for={`questionTooltip${id}`}
    >
      {id && description && onDelete && (
        <div>
          <div className="flex justify-between items-center p-[0.3rem] bg-primary-20">
            <div className="font-bold">{generateTypesShort(intl)[type]}</div>
            <button className="ui basic icon button !p-[3px] !m-0" type="button" onClick={onDelete}>
              <Icon name="trash" />
            </button>
          </div>
          <div className="text-center p-[0.3rem] text-primary-strong">
            <Ellipsis>{title}</Ellipsis>
            {version >= 0 && <span> {`(v${version + 1})`}</span>}
          </div>
        </div>
      )}

      {!(id && description && onDelete) && (
        <>
          <div className="flex justify-between items-center p-[0.3rem] bg-primary-20">
            <div className="font-bold">{generateTypesShort(intl)[type]}</div>

            {onDelete && (
              <button className="ui basic icon button !p-[3px] !m-0" type="button" onClick={onDelete}>
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

          <div className="text-center p-[0.3rem] text-primary-strong">
            <Ellipsis>{title}</Ellipsis>
            {version >= 0 && <span> {`(v${version + 1})`}</span>}
          </div>
        </>
      )}
    </div>
  )
}

QuestionSingle.defaultProps = defaultProps

export default QuestionSingle
