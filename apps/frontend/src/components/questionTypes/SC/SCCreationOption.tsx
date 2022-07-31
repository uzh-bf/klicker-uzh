import React from 'react'
import clsx from 'clsx'
import { Input, Popup } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FormattedMessage } from 'react-intl'
import { faArrowDown, faArrowUp, faCheck, faTrash, faXmark } from '@fortawesome/free-solid-svg-icons'
import { twMerge } from 'tailwind-merge'

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
    <div className={clsx('option h-16', { correct })}>
      <Button
        className="!shadow-none !border-0 !rounded-none bg-uzh-grey-40 justify-center w-12"
        disabled={disabled}
        onClick={handleDelete}
      >
        <FontAwesomeIcon icon={faTrash} size="lg" />
      </Button>

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
          <Button
            className={twMerge(
              'h-10 w-10 self-center mx-2 bg-red-600 text-white justify-center',
              correct && 'bg-green-600'
            )}
            disabled={disabled}
            onClick={handleCorrectToggle}
          >
            {correct ? <FontAwesomeIcon icon={faCheck} /> : <FontAwesomeIcon icon={faXmark} />}
          </Button>
        }
      />

      <Input
        disabled={disabled}
        type="text"
        value={name}
        onChange={(e): void => handleSaveNewName({ newName: e.target.value })}
      />

      <div className="flex flex-col justify-between my-0.5">
        <Button className="!border-none !shadow-none" onClick={handleMoveUp}>
          <FontAwesomeIcon icon={faArrowUp} />
        </Button>
        <Button className="!border-none !shadow-none" onClick={handleMoveDown}>
          <FontAwesomeIcon icon={faArrowDown} />
        </Button>
      </div>

      <style jsx>{styles}</style>
    </div>
  )
}

SCCreationOption.defaultProps = defaultProps

export default SCCreationOption
