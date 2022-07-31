import React, { RefObject, useState } from 'react'
import clsx from 'clsx'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowUp, faCheck, faTrash, faXmark, faPlus } from '@fortawesome/free-solid-svg-icons'
import { twMerge } from 'tailwind-merge'

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

  const onCorrectToggle = (): void => setCorrect((prevCorrect): boolean => !prevCorrect)
  const onInputModeToggle = (): void => {
    setInputMode((prevInputMode): boolean => !prevInputMode)
    focusField.current.focus()
  }
  const onNameChange = (e): void => setName(e.target.value)
  const onSave = (): void => {
    if (!name || name.length === 0) {
      setInputMode(false)
      return
    }
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
    <div className={clsx('option h-16', { inputMode })}>
      <Button
        className={twMerge(
          '!shadow-none !border-0 !rounded-none bg-uzh-grey-40 justify-center leftAction w-full',
          inputMode && 'w-12'
        )}
        disabled={inputMode}
        onClick={onInputModeToggle}
      >
        {inputMode ? <FontAwesomeIcon icon={faTrash} size="lg" /> : <FontAwesomeIcon icon={faPlus} size="lg" />}
      </Button>

      {inputMode && (
        <Button
          className={twMerge(
            'h-10 w-10 self-center mx-2 bg-red-600 text-white justify-center',
            correct && 'bg-green-600'
          )}
          disabled={inputMode}
          onClick={onCorrectToggle}
        >
          {correct ? <FontAwesomeIcon icon={faCheck} /> : <FontAwesomeIcon icon={faXmark} />}
        </Button>
      )}

      <input
        className={twMerge('opactiy-100', !inputMode && 'hidden')}
        ref={focusField}
        type="text"
        value={name}
        onBlur={onSave}
        onChange={onNameChange}
        onKeyDown={onKeyPress}
      />

      {inputMode && (
        <div className="flex flex-col justify-between my-0.5">
          <Button disabled className="!border-none !shadow-none">
            <FontAwesomeIcon icon={faArrowUp} />
          </Button>
          <Button disabled className="!border-none !shadow-none">
            <FontAwesomeIcon icon={faArrowDown} />
          </Button>
        </div>
      )}

      <style jsx>{styles}</style>
    </div>
  )
}

export default SCCreationPlaceholder
