import React from 'react'
import classNames from 'classnames'
import { Icon, Input } from 'semantic-ui-react'
import { Draggable } from 'react-beautiful-dnd'

import styles from './styles'

interface Props {
  correct: boolean
  disabled?: boolean
  handleCorrectToggle: any
  handleDelete: any
  handleSaveNewName: any
  index: number
  name: string
}

const defaultProps = {
  disabled: false,
}

function SCCreationOption({
  correct,
  disabled,
  name,
  handleCorrectToggle,
  handleDelete,
  handleSaveNewName,
  index,
}: Props): React.ReactElement {
  return (
    <Draggable draggableId={`option-${name}`} index={index}>
      {(provided): React.ReactElement => (
        <div
          className={classNames('option', { correct })}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <button className="leftAction" disabled={disabled} type="button" onClick={handleDelete}>
            <Icon name="trash" />
          </button>

          <button
            className={classNames('toggle', { correct })}
            disabled={disabled}
            type="button"
            onClick={handleCorrectToggle}
          >
            {correct ? <Icon name="checkmark" /> : <Icon name="remove" />}
          </button>

          <Input type="text" value={name} onChange={e => handleSaveNewName({ newName: e.target.value })} />

          <div className="grabHandle">
            <Icon name="grab" />
          </div>

          <style jsx>{styles}</style>
        </div>
      )}
    </Draggable>
  )
}

SCCreationOption.defaultProps = defaultProps

export default SCCreationOption
