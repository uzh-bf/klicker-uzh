import { faSave } from '@fortawesome/free-regular-svg-icons'
import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useState } from 'react'

interface DateChangerProps {
  label?: string
  edit: boolean
  date: string
  onEdit: () => void
  onSave: (date: string) => void
}

function DateChanger({ label, edit, date, onEdit, onSave }: DateChangerProps) {
  const [dateState, setDateState] = useState(dayjs(date).format('YYYY-MM-DD'))

  return (
    <div className="flex flex-row items-center">
      {label && <div className="mr-1.5">{label}</div>}
      {edit ? (
        <div className="flex flex-row gap-2 border border-solid rounded">
          <input
            type="date"
            className="px-0 py-1 pl-2 border-none w-max"
            value={dateState}
            onChange={(e) => setDateState(e.target.value)}
          />
          <Button
            basic
            onClick={() => onSave(dateState)}
            className={{
              root: 'px-2 py-1 bg-uzh-blue-20 hover:bg-uzh-blue-40',
            }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faSave} />
            </Button.Icon>
          </Button>
        </div>
      ) : (
        <div className="flex flex-row gap-2 border border-solid rounded">
          <div className="py-1 pl-2">
            {dayjs(dateState).format('DD / MM / YYYY')}
          </div>
          <Button
            basic
            onClick={onEdit}
            className={{ root: 'bg-uzh-grey-20 py-1 px-2' }}
          >
            <Button.Icon>
              <FontAwesomeIcon icon={faPencil} />
            </Button.Icon>
          </Button>
        </div>
      )}
    </div>
  )
}

export default DateChanger
