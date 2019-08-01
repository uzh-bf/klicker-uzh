import React from 'react'
import classNames from 'classnames'
import { Icon } from 'semantic-ui-react'
import SCEditQuestionOption from './SCEditQuestionOption'

import styles from './styles'

interface Props {
  correct: boolean
  disabled?: boolean
  handleCorrectToggle: any
  handleDelete: any
  name: string
  handleToggleEditMode: any
  handleSaveNewName: any
  handleDiscardNewName: any
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
  handleToggleEditMode,
  handleSaveNewName,
  handleDiscardNewName,
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

      <SCEditQuestionOption
        editMode={false}
        handleDiscardNewName={handleDiscardNewName}
        handleSaveNewName={handleSaveNewName}
        handleToggleEditMode={handleToggleEditMode}
        name={name}
      />

      <style jsx>{styles}</style>
    </div>
  )
}

SCCreationOption.defaultProps = defaultProps

export default SCCreationOption
