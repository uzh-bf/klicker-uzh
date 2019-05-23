import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { compose, withHandlers, withState } from 'recompose'
import { Icon } from 'semantic-ui-react'
import styles from './styles'

const propTypes = {
  name: PropTypes.string.isRequired,
  editMode: PropTypes.bool.isRequired,
  handleToggleEditMode: PropTypes.func.isRequired,
  handleSaveNewName: PropTypes.func.isRequired,
  handleDiscardNewName: PropTypes.func.isRequired,
  handleNameChange: PropTypes.func.isRequired,
  handleKeyPress: PropTypes.func.isRequired,
  focusField: PropTypes.func.isRequired,
}

const SCEditQuestionOption = ({
  name,
  editMode,
  handleToggleEditMode,
  handleSaveNewName,
  handleDiscardNewName,
  handleNameChange,
  handleKeyPress,
  focusField,
}) => (
  <div className="optionEditCont">
    <div className="optionEdit">
      {editMode ? (
        <input ref={focusField} type="text" value={name} onChange={handleNameChange} onKeyDown={handleKeyPress} />
      ) : (
        <div className="name">{name}</div>
      )}
    </div>

    <div className="editOptBtnRight">
      {editMode ? (
        <button className={classNames('rightAction', { editMode })} type="button" onClick={handleSaveNewName}>
          <Icon name="save" />
        </button>
      ) : null}
      {editMode ? (
        <button className={classNames('rightAction', { editMode })} type="button" onClick={handleDiscardNewName}>
          <Icon name="delete" />
        </button>
      ) : null}
      {!editMode ? (
        <button className={classNames('rightAction', { editMode })} type="button" onClick={handleToggleEditMode}>
          <Icon name="edit" />
        </button>
      ) : null}
    </div>
    <style jsx>{styles}</style>
  </div>
)

SCEditQuestionOption.propTypes = propTypes

export default compose(
  withState('editMode', 'setEditMode', props => props.editMode),
  withState('name', 'setName', props => props.name),
  withState('origName', 'setOrigName', props => {
    return props.name
  }),

  withHandlers({
    // Workaround, since input element is rendered conditionally
    focusField: () => e => {
      if (e != null) {
        e.focus()
      }
    },
    handleNameChange: ({ setName }) => e => setName(e.target.value),
    handleToggleEditMode: ({ setEditMode }) => () => {
      setEditMode(editMode => !editMode)
    },

    handleSaveNewName: ({ name, setEditMode, handleSaveNewName, setOrigName }) => () => {
      setEditMode(false)
      setOrigName(name)
      const newName = name
      handleSaveNewName({ newName })
    },

    handleDiscardNewName: ({ setEditMode, origName, setName }) => () => {
      setEditMode(false)
      setName(origName)
    },
  }),
  withHandlers({
    handleKeyPress: ({
      name,
      setEditMode,
      setName,
      setOrigName,
      origName,
      handleSaveNewName,
      handleDiscardNewName,
    }) => keypress => {
      if (keypress.key === 'Enter') {
        handleSaveNewName(name, setEditMode, handleSaveNewName, setOrigName)
      } else if (keypress.key === 'Escape') {
        handleDiscardNewName(setEditMode, origName, setName)
      }
    },
  })
)(SCEditQuestionOption)
