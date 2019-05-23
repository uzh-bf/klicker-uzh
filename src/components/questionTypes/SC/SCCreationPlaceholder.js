import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { compose, withHandlers, withState } from 'recompose'
import { Icon } from 'semantic-ui-react'
import styles from './styles'

const propTypes = {
  correct: PropTypes.bool.isRequired,
  handleCorrectToggle: PropTypes.func.isRequired,
  handleModeToggle: PropTypes.func.isRequired,
  handleNameChange: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
  inputMode: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  handleKeyPress: PropTypes.func.isRequired,
}

// create ref to be assigned to the input field
const focusField = React.createRef()

// create the purely functional component
const SCCreationPlaceholder = ({
  correct,
  inputMode,
  name,
  handleCorrectToggle,
  handleModeToggle,
  handleNameChange,
  handleSave,
  handleKeyPress,
}) => (
  <div className={classNames('option', { inputMode })}>
    <button className="leftAction" type="button" onClick={handleModeToggle}>
      {inputMode ? <Icon name="trash" /> : <Icon name="plus" />}
    </button>

    <button className={classNames('toggle', { correct })} type="button" onClick={handleCorrectToggle}>
      {correct ? <Icon name="checkmark" /> : <Icon name="remove" />}
    </button>

    <input ref={focusField} type="text" value={name} onChange={handleNameChange} onKeyDown={handleKeyPress} />

    <button className="rightAction" type="button" onClick={handleSave}>
      <Icon name="save" />
    </button>

    <style jsx>{styles}</style>
    <style jsx>
      {`
        .leftAction {
          flex: 0 0 100%;

          border-right: none;
          transition: flex-basis 0.3s;
        }

        input,
        .toggle,
        .rightAction {
          flex: 1;

          opacity: 0;
        }

        .inputMode > input,
        .inputMode > .toggle,
        .inputMode > .rightAction {
          opacity: 1;
        }

        .inputMode > .leftAction,
        .inputMode > .rightAction {
          flex: 0 0 3rem;
        }

        .inputMode > .leftAction {
          border-right: 1px solid grey;
        }

        .inputMode > .toggle {
          flex: 0 0 auto;
        }

        .inputMode > input {
          flex: 1;
        }
      `}
    </style>
  </div>
)

SCCreationPlaceholder.propTypes = propTypes

export default compose(
  withState('correct', 'setCorrect', false),
  withState('inputMode', 'setInputMode', false),
  withState('name', 'setName', ''),
  withHandlers({
    handleCorrectToggle: ({ setCorrect }) => () => setCorrect(correct => !correct),

    handleModeToggle: ({ setInputMode }) => () => {
      setInputMode(inputMode => !inputMode)
      focusField.current.focus()
    },

    handleNameChange: ({ setName }) => e => setName(e.target.value),

    handleSave: ({ correct, name, handleSave, setCorrect, setInputMode, setName }) => () => {
      setCorrect(false)
      setInputMode(false)
      setName('')
      handleSave({ correct, name })
    },
  }),
  withHandlers({
    handleKeyPress: ({ correct, name, handleSave, setCorrect, setInputMode, setName }) => keypress => {
      if (keypress.key === 'Enter') {
        keypress.preventDefault()
        handleSave(correct, name, handleSave, setCorrect, setInputMode, setName)
        setInputMode(true)
      } else if (keypress.key === 'Escape') {
        setCorrect(false)
        setInputMode(false)
        setName('')
      }
    },
  })
)(SCCreationPlaceholder)
