/* eslint-disable no-unused-vars */
import React, { useState } from 'react'
import { Icon, Modal, Button, Checkbox, Step } from 'semantic-ui-react'
import { useIntl, defineMessages, FormattedMessage } from 'react-intl'

import Authentication from './Authentication'
import Participants from './Participants'

export type AuthenticationMode = 'NONE' | 'PASSWORD' | 'AAI'

const messages = defineMessages({
  participantAuthentication: {
    defaultMessage: 'Participant Authentication',
    id: 'form.createSession.participantAuth.string.participantAuthentication',
  },
  xParticipants: {
    defaultMessage: '{num} Participants',
    id: 'form.createSession.participantAuth.button.xParticipants',
  },
  setParticipants: {
    defaultMessage: 'Set Participants',
    id: 'form.createSession.participantAuth.button.setParticipants',
  },
})

interface Props {
  isAuthenticationEnabled: boolean
  onChangeIsAuthenticationEnabled: (newValue: boolean) => void
  participants: string[]
  onChangeParticipants: (participants: string[]) => void
  onChangeAuthenticationMode: (mode: AuthenticationMode) => void
  authenticationMode: AuthenticationMode
}

function SessionParticipantsModal({
  isAuthenticationEnabled,
  onChangeIsAuthenticationEnabled,
  participants,
  onChangeParticipants,
  onChangeAuthenticationMode,
  authenticationMode,
}: Props): React.ReactElement {
  const intl = useIntl()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const onDiscardSettings = (): void => {
    onChangeParticipants([])
    onChangeAuthenticationMode(null)
    setActiveStep(0)
    setIsModalOpen(false)
  }

  const onChangeAuthenticationEnabled = (): void => {
    // if authentication will be disabled, reset the participants
    if (isAuthenticationEnabled) {
      onDiscardSettings()
    }
    onChangeIsAuthenticationEnabled(!isAuthenticationEnabled)
  }

  const onSaveParticipants = (): void => {
    setIsModalOpen(false)
  }

  const triggerButton = (
    <div>
      {isAuthenticationEnabled && (
        <Button
          fluid
          icon
          className="!mt-2"
          color={!participants || participants.length === 0 ? 'red' : 'grey'}
          labelPosition="left"
          size="small"
          type="button"
          onClick={(): void => setIsModalOpen(true)}
        >
          <Icon name="lock" />
          {participants && participants.length > 0
            ? intl.formatMessage(messages.xParticipants, { num: participants.length })
            : intl.formatMessage(messages.setParticipants)}
        </Button>
      )}
    </div>
  )

  return (
    <div className="sessionParticipantsModal">
      <Modal open={isModalOpen} size="large" trigger={triggerButton} onClose={(): void => setIsModalOpen(false)}>
        <Modal.Header>
          <FormattedMessage
            defaultMessage="Participant Authentication"
            id="form.createSession.participantAuth.string.participantAuthentication"
          />
        </Modal.Header>

        {activeStep === 0 && (
          <Authentication
            sessionAuthenticationMode={authenticationMode}
            onActivateNextStep={(): void => setActiveStep(1)}
            onChangeSessionAuthenticationMode={onChangeAuthenticationMode}
          />
        )}

        {activeStep === 1 && (
          <Participants
            participants={participants}
            onActivatePreviousStep={(): void => setActiveStep(0)}
            onChangeParticipants={onChangeParticipants}
            onSaveSettings={onSaveParticipants}
          />
        )}

        <Step.Group attached="top" size="small">
          <Step active={activeStep === 0} onClick={(): void => setActiveStep(0)}>
            <Icon name="lock" />
            <Step.Content>
              <Step.Title>
                <FormattedMessage
                  defaultMessage="Authentication"
                  id="form.createSession.participantAuth.steps.authentication"
                />
              </Step.Title>
            </Step.Content>
          </Step>

          <Step active={activeStep === 1} onClick={(): void => setActiveStep(1)}>
            <Icon name="list" />
            <Step.Content>
              <Step.Title>
                <FormattedMessage
                  defaultMessage="Participants"
                  id="form.createSession.participantAuth.steps.participants"
                />
              </Step.Title>
            </Step.Content>
          </Step>
        </Step.Group>
      </Modal>
    </div>
  )
}

export default SessionParticipantsModal
