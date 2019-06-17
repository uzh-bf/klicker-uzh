import React from 'react'
import PropTypes from 'prop-types'
import { Button, Header, Icon, Modal } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { compose, withState, withHandlers } from 'recompose'

const propTypes = {
  open: PropTypes.bool.isRequired,
  handleOpen: PropTypes.func.isRequired,
  handleClose: PropTypes.func.isRequired,
  handleCancelSession: PropTypes.func.isRequired,
}

const CancelModal = ({ open, handleOpen, handleClose, handleCancelSession }) => (
  <Modal
    basic
    open={open}
    size="small"
    trigger={
      <Button icon labelPosition="left" size="small" onClick={handleOpen}>
        <FormattedMessage defaultMessage="Cancel Session" id="sessionArea.button.cancelSession" />
        <Icon name="cancel" />
      </Button>
    }
    onClose={handleClose}
    onOpen={handleOpen}
  >
    <Header
      content={<FormattedMessage defaultMessage="Cancel Session" id="sessionArea.button.cancelSession" />}
      icon="browser"
    />
    <Modal.Content>
      <FormattedMessage
        defaultMessage="Are you sure you want to cancel the current session? Session progress and all submitted Answers will be lost"
        id="sessionArea.button.cancelSessionWarning"
      />
    </Modal.Content>
    <Modal.Actions>
      <Button inverted color="red" onClick={handleClose}>
        <Icon name="checkmark" /> <FormattedMessage defaultMessage="No" id="common.button.no" />
      </Button>
      <Button inverted color="green" onClick={handleCancelSession}>
        <Icon name="checkmark" /> <FormattedMessage defaultMessage="Yes" id="common.button.yes" />
      </Button>
    </Modal.Actions>
  </Modal>
)

CancelModal.propTypes = propTypes

export default compose(
  withState('open', 'setOpen', false),
  withHandlers({
    handleClose: ({ setOpen }) => () => setOpen(false),
    handleOpen: ({ setOpen }) => () => setOpen(true),
  })
)(CancelModal)
