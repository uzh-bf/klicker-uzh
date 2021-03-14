import classNames from 'classnames'
import React from 'react'
import { Button, Icon, Input } from 'semantic-ui-react'
import styles from './styles'

interface Props {
  correct: boolean
  disabled?: boolean
  handleCorrectToggle: any
  handleDelete: any
  handleSaveNewName: any
  handleMoveUp: any
  handleMoveDown: any
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
  handleMoveUp,
  handleMoveDown,
}: Props): React.ReactElement {
  return (
    <div className={classNames('option', { correct })}>
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

      <Input
        disabled={disabled}
        type="text"
        value={name}
        onChange={(e): void => handleSaveNewName({ newName: e.target.value })}
      />

      <div className="moveHandles">
        <Button basic icon="arrow up" size="mini" type="button" onClick={handleMoveUp} />
        <Button basic icon="arrow down" size="mini" type="button" onClick={handleMoveDown} />
      </div>

      <style jsx>{styles}</style>
    </div>
  )
}

SCCreationOption.defaultProps = defaultProps

export default SCCreationOption
