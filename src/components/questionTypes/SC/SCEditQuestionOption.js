import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { compose, withHandlers, withState } from 'recompose'
import { Icon } from 'semantic-ui-react'
import styles from './styles'

const propTypes = {
  name: PropTypes.string.isRequired,
  editMode: PropTypes.bool.isRequired,
  toggleEditMode: PropTypes.func.isRequired,
  saveNewName: PropTypes.func.isRequired,
  discardNewName: PropTypes.func.isRequired,
  handleNameChange: PropTypes.func.isRequired,
  handleKeyPress: PropTypes.func.isRequired,
}

const SCEditQuestionOption = ({
  name,
  editMode,
  toggleEditMode,
  saveNewName,
  discardNewName,
  handleNameChange,
  handleKeyPress,
}) => (
  <div className="optionEditCont">
    <div className="optionEdit">
      {editMode ? (
        <input type="text" value={name} onChange={handleNameChange} onKeyDown={handleKeyPress} />
      ) : (
        <div className="name">{name}</div>
      )}
    </div>

    <div className="editOptBtnRight">
      {editMode ? (
        <button className={classNames('rightAction', { editMode })} type="button" onClick={saveNewName}>
          <Icon name="save" />
        </button>
      ) : null}
      {editMode ? (
        <button className={classNames('rightAction', { editMode })} type="button" onClick={discardNewName}>
          <Icon name="delete" />
        </button>
      ) : null}
      {!editMode ? (
        <button className={classNames('rightAction', { editMode })} type="button" onClick={toggleEditMode}>
          <Icon name="edit" />
        </button>
      ) : null}
    </div>
    <style jsx>{styles}</style>
  </div>
)

SCEditQuestionOption.propTypes = propTypes

export default compose(
  withState('editMode', 'setEditMode', false),
  withState('name', 'setName', props => {
    return props.name
  }),
  withState('origName', 'setOrigName', props => {
    return props.name
  }),

  withHandlers({
    handleNameChange: ({ setName }) => e => setName(e.target.value),
    toggleEditMode: ({ setEditMode }) => () => setEditMode(editMode => !editMode),

    saveNewName: ({ name, setEditMode, saveNewName, setOrigName }) => () => {
      setEditMode(false)
      setOrigName(name)
      const newName = name
      saveNewName({ newName })
    },

    discardNewName: ({ setEditMode, origName, setName }) => () => {
      setEditMode(false)
      setName(origName)
    },

    handleKeyPress: ({ name, setEditMode, setName, setOrigName, origName, saveNewName }) => keypress => {
      if (keypress.key === 'Enter') {
        setEditMode(false)
        setOrigName(name)
        const newName = name
        saveNewName({ newName })
      } else if (keypress.key === 'Escape') {
        setEditMode(false)
        setName(origName)
      }
    },
  })
)(SCEditQuestionOption)
