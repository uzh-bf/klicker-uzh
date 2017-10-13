/* eslint-disable react/prop-types */

import React from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import { compose, withHandlers, withState } from 'recompose'
import { FaFloppyO, FaPlus, FaTrash } from 'react-icons/lib/fa'

import styles from './styles'

const propTypes = {
  handleSave: PropTypes.func.isRequired,
}

// compose state and handlers for the option creation placeholder
const enhance = compose(
  withState('correct', 'setCorrect', false),
  withState('inputMode', 'setInputMode', false),
  withState('name', 'setName', ''),
  withHandlers({
    handleCorrectToggle: ({ setCorrect }) => () => setCorrect(correct => !correct),

    handleModeToggle: ({ setInputMode }) => () => setInputMode(inputMode => !inputMode),

    handleNameChange: ({ setName }) => e => setName(e.target.value),

    handleSave: ({
      correct, name, handleSave, setCorrect, setInputMode, setName,
    }) => () => {
      setCorrect(false)
      setInputMode(false)
      setName('')
      handleSave({ correct, name })
    },
  }),
)

// create the purely functional component
const Placeholder = ({
  correct,
  inputMode,
  name,
  handleCorrectToggle,
  handleModeToggle,
  handleNameChange,
  handleSave,
}) => (
  <div className={classNames('option', { inputMode })}>
    <button className="leftAction" type="button" onClick={handleModeToggle}>
      {inputMode ? <FaTrash /> : <FaPlus />}
    </button>

    <button
      className={classNames('toggle', { correct })}
      type="button"
      onClick={handleCorrectToggle}
    >
      {correct ? 'TRUE' : 'FALSE'}
    </button>

    <input type="text" value={name} onChange={handleNameChange} />

    <button className="rightAction" type="button" onClick={handleSave}>
      <FaFloppyO />
    </button>

    <style jsx>{styles}</style>
    <style jsx>{`
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
        flex: 0 0 5rem;
      }

      .inputMode > input {
        flex: 1;
      }
    `}</style>
  </div>
)

const EnhancedPlaceholder = enhance(Placeholder)
EnhancedPlaceholder.propTypes = propTypes

export default EnhancedPlaceholder
