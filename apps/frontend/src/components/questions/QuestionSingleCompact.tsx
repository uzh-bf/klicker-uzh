import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import React from 'react'
import { useIntl } from 'react-intl'

import { generateTypesLabel, generateTypesShort } from '../../lib/utils/lang'

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

            <Button className="justify-center w-6 h-6" onClick={onDelete}>
              <Button.Icon>
                <FontAwesomeIcon icon={faTrash} />
              </Button.Icon>
            </Button>
          </div>

          <div className="group">
            <div className="block group-hover:hidden">{title.length < 12 ? title : `${title.substring(0, 12)}...`}</div>
            <div className="hidden group-hover:block">{title}</div>
          </div>
          <Button className="justify-center w-6 h-6 group-hover:hidden" onClick={onDelete}>
            <Button.Icon>
              <FontAwesomeIcon icon={faTrash} />
            </Button.Icon>
          </Button>
        </div>
      </div>
    </>
  )
}

export default QuestionSingleCompact
