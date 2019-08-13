import React, { useState } from 'react'
import { Button, Header, Icon, Modal } from 'semantic-ui-react'
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
        <Button icon labelPosition="left" size="small" onClick={(): void => setIsOpen(true)}>
          <FormattedMessage defaultMessage="Cancel Session" id="sessionArea.button.cancelSession" />
          <Icon name="cancel" />
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
        <Button onClick={(): void => setIsOpen(false)}>
          <FormattedMessage defaultMessage="No" id="common.button.no" />
        </Button>
        <Button primary onClick={handleCancelSession}>
          <FormattedMessage defaultMessage="Yes" id="common.button.yes" />
        </Button>
      </Modal.Actions>
    </Modal>
  )
}

export default CancelModal
