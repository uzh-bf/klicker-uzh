import React, { useState } from 'react'
import classNames from 'classnames'
import { Icon, Modal, Button, Checkbox, Step, Message, Segment, Grid, Divider, Header, Search } from 'semantic-ui-react'
import Authentication from './Authentication'
import Participants from './Participants'
import DataStorage from './DataStorage'

export type AuthenticationMode = 'password' | 'aai'
export type DataStorageMode = 'complete' | 'secret'

interface Props {
  isAuthenticationEnabled: boolean
  onChangeIsAuthenticationEnabled: (newValue: boolean) => void
  participants: string[]
  onChangeParticipants: (participants: string[]) => void
  onChangeAuthenticationMode: (mode: AuthenticationMode) => void
  authenticationMode: AuthenticationMode
  dataStorageMode: DataStorageMode
  onChangeDataStorageMode: (mode: DataStorageMode) => void
}

function SessionParticipantsModal({
  isAuthenticationEnabled,
  onChangeIsAuthenticationEnabled,
  participants,
  onChangeParticipants,
  onChangeAuthenticationMode,
  authenticationMode,
  dataStorageMode,
  onChangeDataStorageMode,
}: Props): React.ReactElement {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [activeStep, setActiveStep] = useState(0)

  const onDiscardSettings = (): void => {
    onChangeParticipants([])
    onChangeAuthenticationMode(null)
    onChangeDataStorageMode(null)
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
      <Checkbox
        checked={isAuthenticationEnabled}
        label="Participant authentication"
        size="tiny"
        onChange={onChangeAuthenticationEnabled}
      />
      {isAuthenticationEnabled && (
        <Button
          fluid
          icon
          color={isAuthenticationEnabled && (!participants || participants.length === 0) ? 'red' : 'grey'}
          labelPosition="left"
          size="small"
          type="button"
          onClick={(): void => setIsModalOpen(true)}
        >
          <Icon name="lock" />
          {participants && participants.length > 0 ? `Update ${participants.length} Participants` : 'Set Participants'}
        </Button>
      )}
    </div>
  )

  return (
    <div className="sessionParticipantsModal">
      <Modal open={isModalOpen} size="large" trigger={triggerButton} onClose={(): void => setIsModalOpen(false)}>
        <Modal.Header>Participant Authentication</Modal.Header>

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
            onActivateNextStep={(): void => setActiveStep(2)}
            onActivatePreviousStep={(): void => setActiveStep(0)}
            onChangeParticipants={onChangeParticipants}
          />
        )}

        {activeStep === 2 && (
          <DataStorage
            dataStorageMode={dataStorageMode}
            onActivatePreviousStep={(): void => setActiveStep(1)}
            onChangeDataStorageMode={onChangeDataStorageMode}
            onSaveSettings={onSaveParticipants}
          />
        )}

        <Step.Group attached="top" size="small">
          <Step active={activeStep === 0} onClick={(): void => setActiveStep(0)}>
            <Icon name="lock" />
            <Step.Content>
              <Step.Title>Authentication</Step.Title>
            </Step.Content>
          </Step>
          <Step active={activeStep === 1} onClick={(): void => setActiveStep(1)}>
            <Icon name="list" />
            <Step.Content>
              <Step.Title>Participants</Step.Title>
            </Step.Content>
          </Step>
          <Step active={activeStep === 2} onClick={(): void => setActiveStep(2)}>
            <Icon name="database" />
            <Step.Content>
              <Step.Title>Data Storage</Step.Title>
            </Step.Content>
          </Step>
        </Step.Group>
      </Modal>
      <style jsx>{`
        @import 'src/theme';

        .button {
          margin-top: 0 !important;
        }
      `}</style>
    </div>
  )
}

export default SessionParticipantsModal
