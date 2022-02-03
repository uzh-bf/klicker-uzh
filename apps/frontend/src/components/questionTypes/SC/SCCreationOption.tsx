import React from 'react'
import clsx from 'clsx'
import { Icon, Button, Input, Popup } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

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
    <div className={clsx('option', { correct })}>
      <button className="leftAction" disabled={disabled} type="button" onClick={handleDelete}>
        <Icon name="trash" />
      </button>

      <Popup
        inverted
        wide
        content={
          <FormattedMessage
            defaultMessage="Toggle to define whether the option is correct (marked in green) or incorrect (marked in red)."
            id="createQuestion.optionsSC.solutionToggle.tooltip"
          />
        }
        mouseEnterDelay={250}
        mouseLeaveDelay={250}
        position="right center"
        size="small"
        style={{ opacity: 0.9 }}
        trigger={
          <button
            className={clsx('toggle', { correct })}
            disabled={disabled}
            type="button"
            onClick={handleCorrectToggle}
          >
            {correct ? <Icon name="checkmark" /> : <Icon name="remove" />}
          </button>
        }
      />

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
