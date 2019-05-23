import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { Icon } from 'semantic-ui-react'
import SCEditQuestionOption from './SCEditQuestionOption'

import styles from './styles'

const propTypes = {
  correct: PropTypes.bool.isRequired,
  disabled: PropTypes.bool,
  handleCorrectToggle: PropTypes.func.isRequired,
  handleDelete: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  handleToggleEditMode: PropTypes.func.isRequired,
  handleSaveNewName: PropTypes.func.isRequired,
  handleDiscardNewName: PropTypes.func.isRequired,
}

const defaultProps = {
  disabled: false,
}

const SCCreationOption = ({
  correct,
  disabled,
  name,
  handleCorrectToggle,
  handleDelete,
  handleToggleEditMode,
  handleSaveNewName,
  handleDiscardNewName,
}) => (
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

SCCreationOption.propTypes = propTypes
SCCreationOption.defaultProps = defaultProps

export default SCCreationOption
