import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button, Modal } from '@uzh-bf/design-system'
import React, { useState } from 'react'

interface Props {
  handleCancelSession: () => void
}

function CancelModal({ handleCancelSession }: Props): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Modal
      open={isOpen}
      size="small"
      trigger={
        <Button
          className="flex-1 h-10 px-4 sm:flex-initial"
          onClick={(): void => setIsOpen(true)}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faXmark} size="lg" />
          </Button.Icon>
          <Button.Label>Session abbrechen</Button.Label>
        </Button>
      }
      onClose={(): void => setIsOpen(false)}
      onOpen={(): void => setIsOpen(true)}
    >
      <div>HEADER Session Abbrechen mit Icon Browser</div>
      Sind Sie sicher, dass Sie die aktuelle Session abbrechen wollen? Der
      Sessions-Verlauf und alle eingegangenen Antworten werden gelöscht.
      <Button
        className="h-10 px-4 mr-2 font-bold"
        onClick={(): void => setIsOpen(false)}
      >
        <Button.Label>Nein</Button.Label>
      </Button>
      <Button
        className="h-10 px-4 mr-2 font-bold text-white bg-uzh-blue-80"
        onClick={handleCancelSession}
      >
        <Button.Label>Ja</Button.Label>
      </Button>
    </Modal>
  )
}

export default CancelModal
