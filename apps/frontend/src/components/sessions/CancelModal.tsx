import React, { useState } from 'react'
import { Header, Modal } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FormattedMessage } from 'react-intl'

interface Props {
  handleCancelSession: () => void
}

function CancelModal({ handleCancelSession }: Props): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Modal
      // basic
      open={isOpen}
      size="small"
      trigger={
        <Button className="flex-1 h-10 px-4 sm:flex-initial" onClick={(): void => setIsOpen(true)}>
          <FontAwesomeIcon icon={faXmark} size="lg" />
          <FormattedMessage defaultMessage="Cancel Session" id="sessionArea.button.cancelSession" />
        </Button>
      }
      onClose={(): void => setIsOpen(false)}
      onOpen={(): void => setIsOpen(true)}
    >
      <Header
        content={<FormattedMessage defaultMessage="Cancel Session" id="sessionArea.button.cancelSession" />}
        icon="browser"
      />
      <Modal.Content>
        <FormattedMessage
          defaultMessage="Are you sure you want to cancel the current session? Session progress and submitted answers will be lost."
          id="sessionArea.button.cancelSessionWarning"
        />
      </Modal.Content>
      <Modal.Actions>
        <Button className="h-10 px-4 mr-2 font-bold" onClick={(): void => setIsOpen(false)}>
          <FormattedMessage defaultMessage="No" id="common.button.no" />
        </Button>
        <Button className="h-10 px-4 mr-2 font-bold text-white bg-uzh-blue-80" onClick={handleCancelSession}>
          <FormattedMessage defaultMessage="Yes" id="common.button.yes" />
        </Button>
      </Modal.Actions>
    </Modal>
  )
}

export default CancelModal
