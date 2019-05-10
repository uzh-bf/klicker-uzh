/* eslint-disable react/jsx-sort-props */
/* eslint-disable react/destructuring-assignment */
import React, { Component } from 'react'
import { Button, Header, Icon, Modal } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

export default class CancelModal extends Component {
  state = { modalOpen: false }

  handleOpen = () => this.setState({ modalOpen: true })

  handleClose = () => this.setState({ modalOpen: false })

  handleSubmit = () => {
    this.setState({ modalOpen: false })
    // eslint-disable-next-line react/prop-types
    this.props.cancelSession()
  }

  render() {
    return (
      <Modal
        basic
        size="small"
        trigger={
          <Button icon labelPosition="left" size="small" onClick={this.handleOpen}>
            <FormattedMessage defaultMessage="Cancel Session" id="sessionArea.button.cancelSession" />
            <Icon name="cancel" />
          </Button>
        }
        // eslint-disable-next-line react/jsx-sort-props
        onClose={this.handleClose}
        // eslint-disable-next-line react/destructuring-assignment
        open={this.state.modalOpen}
      >
        <Header content="Cancel Session" icon="browser" />
        <Modal.Content>
          <FormattedMessage
            defaultMessage="Are you sure you want to cancel the current session? All entered inputs will be lost."
            id="sessionArea.button.cancelSessionWarning"
          />
        </Modal.Content>
        <Modal.Actions>
          <Button color="red" onClick={this.handleClose} inverted>
            <Icon name="checkmark" /> <FormattedMessage defaultMessage="No" id="common.button.no" />
          </Button>
          <Button color="green" onClick={this.handleSubmit} inverted>
            <Icon name="checkmark" /> <FormattedMessage defaultMessage="Yes" id="common.button.yes" />
          </Button>
        </Modal.Actions>
      </Modal>
    )
  }
}
