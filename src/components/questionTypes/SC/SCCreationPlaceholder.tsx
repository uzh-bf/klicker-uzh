import React, { RefObject, useState } from 'react'
import classNames from 'classnames'
import { Icon } from 'semantic-ui-react'
import styles from './styles'

interface Props {
  handleSave: any
}

// create ref to be assigned to the input field
const focusField: RefObject<HTMLInputElement> = React.createRef()

// create the purely functional component
function SCCreationPlaceholder({ handleSave }: Props): React.ReactElement {
  const [correct, setCorrect] = useState(false)
  const [inputMode, setInputMode] = useState(false)
  const [name, setName] = useState('')

  const onCorrectToggle = (): void => setCorrect(prevCorrect => !prevCorrect)
  const onInputModeToggle = (): void => {
    setInputMode(prevInputMode => !prevInputMode)
    focusField.current.focus()
  }
  const onNameChange = (e): void => setName(e.target.value)
  const onSave = (): void => {
    handleSave({ correct, name })
    setCorrect(false)
    setInputMode(false)
    setName('')
  }
  const onKeyPress = (keypress): void => {
    if (keypress.key === 'Enter') {
      keypress.preventDefault()
      onSave()
      setInputMode(true)
    } else if (keypress.key === 'Escape') {
      setCorrect(false)
      setInputMode(false)
      setName('')
    }
  }

  return (
    <div className={classNames('option', { inputMode })}>
      <button className="leftAction" type="button" onClick={onInputModeToggle}>
        {inputMode ? <Icon name="trash" /> : <Icon name="plus" />}
      </button>

      <button className={classNames('toggle', { correct })} type="button" onClick={onCorrectToggle}>
        {correct ? <Icon name="checkmark" /> : <Icon name="remove" />}
      </button>

      <input ref={focusField} type="text" value={name} onChange={onNameChange} onKeyDown={onKeyPress} />

      <button className="rightAction" type="button" onClick={onSave}>
        <Icon name="save" />
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
          flex: 0 0 auto;
        }

        .inputMode > input {
          flex: 1;
        }
      `}</style>
    </div>
  )
}

export default SCCreationPlaceholder
