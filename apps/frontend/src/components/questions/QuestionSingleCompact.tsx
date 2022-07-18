import React from 'react'
import { Icon } from 'semantic-ui-react'
import { useIntl } from 'react-intl'

import { generateTypesShort, generateTypesLabel } from '../../lib/utils/lang'

interface Props {
  id: string
  onDelete: () => void
  title: string
  type: string
}

function QuestionSingleCompact({ id, type, title, onDelete }: Props): React.ReactElement {
  const intl = useIntl()

  return (
    <>
      <div className="mb-2 border border-solid rounded bg-grey-20 group" id={id}>
        <div className="flex flex-row group-hover:flex-col justify-between items-center p-[0.3rem]">
          <div className="block font-bold group-hover:hidden">{generateTypesShort(intl)[type]}</div>
          <div className="flex-row justify-between hidden w-full font-bold group-hover:flex">
            <div className="">{generateTypesLabel(intl)[type]}</div>
            <button className="ui basic icon button !p-[3px] !m-0" type="button" onClick={onDelete}>
              <Icon name="trash" />
            </button>
          </div>

          <div className="group">
            <div className="block group-hover:hidden">{title.length < 12 ? title : `${title.substring(0, 12)}...`}</div>
            <div className="hidden group-hover:block">{title}</div>
          </div>
          <button className="ui basic icon button !p-[3px] !m-0 group-hover:hidden" type="button" onClick={onDelete}>
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </>
  )
}

export default QuestionSingleCompact
