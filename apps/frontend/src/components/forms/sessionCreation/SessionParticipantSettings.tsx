/* eslint-disable no-unused-vars */
import React, { useState } from 'react'
import { Icon, Modal, Button, Checkbox, Step } from 'semantic-ui-react'
import { useIntl, defineMessages, FormattedMessage } from 'react-intl'

import CustomSwitch from '../../common/CustomSwitch'
import CustomTooltip from '../../common/CustomTooltip'
import CustomCheckbox from '../../common/CustomCheckbox'

export type AuthenticationMode = 'NONE' | 'PASSWORD' | 'AAI'

const messages = defineMessages({
  participantAuthentication: {
    defaultMessage: 'Participant Authentication',
    id: 'form.createSession.participantAuth.string.participantAuthentication',
  },
  //   xParticipants: {
  //     defaultMessage: '{num} Participants',
  //     id: 'form.createSession.participantAuth.button.xParticipants',
  //   },
  //   setParticipants: {
  //     defaultMessage: 'Set Participants',
  //     id: 'form.createSession.participantAuth.button.setParticipants',
  //   },
  passwordDistributionDescription: {
    defaultMessage:
      'After your upload of a list of arbitrary usernames/pseudonyms, we generate a list of username-password combinations that you can distribute to your participants.',
    id: 'form.createSession.participantAuth.passwordDistribution.description',
  },
  switchAAIDescription: {
    defaultMessage:
      'After your upload of a list of SwitchAAI accounts (exact matches by email), participants will get access to your KlickerUZH session using their personal SwitchAAI login. Therefore, you will not be able to emulate any of your participants.',
    id: 'form.createSession.participantAuth.switchAai.description',
  },
})

interface SessionParticipantSettingProps {
  isAuthenticationEnabled: boolean
  onChangeIsAuthenticationEnabled: (newValue: boolean) => void
  participants: string[]
  onChangeParticipants: (participants: string[]) => void
  onChangeAuthenticationMode: (mode: AuthenticationMode) => void
  authenticationMode: AuthenticationMode
}

function SessionParticipantSettings({
  isAuthenticationEnabled,
  onChangeIsAuthenticationEnabled,
  participants,
  onChangeParticipants,
  onChangeAuthenticationMode,
  authenticationMode,
}: SessionParticipantSettingProps): React.ReactElement {
  const intl = useIntl()

  const onChangeAuthenticationEnabled = (): void => {
    // if authentication will be disabled, reset the participants
    if (isAuthenticationEnabled) {
      onChangeParticipants([])
      onChangeAuthenticationMode(null)
    }
    onChangeIsAuthenticationEnabled(!isAuthenticationEnabled)
  }

  console.log(authenticationMode)

  return (
    <div>
      <div className="flex flex-row">
        <CustomCheckbox
          checked={isAuthenticationEnabled}
          className="my-auto mr-2"
          id="participant-checkbox"
          onCheck={() => {
            onChangeAuthenticationEnabled()
            onChangeAuthenticationMode('PASSWORD')
          }} // () => onChangeIsAuthenticationEnabled(!isAuthenticationEnabled)
        />
        <div className="h-full my-auto">{intl.formatMessage(messages.participantAuthentication)}</div>
      </div>

      {isAuthenticationEnabled && (
        <div className="flex flex-row h-10 py-auto">
          <div className="my-auto">
            <FormattedMessage
              defaultMessage="Password Distribution"
              id="form.createSession.participantAuth.passwordDistribution.title"
            />
            <CustomTooltip
              tooltip={intl.formatMessage(messages.passwordDistributionDescription)}
              tooltipStyle={'max-w-[20%] sm:max-w-[30%] md:max-w-[40%]'}
              triggerStyle={'!ml-2'}
              withArrow={false}
            >
              <Icon className="icon" color="blue" name="question circle" />
            </CustomTooltip>
          </div>
          <CustomSwitch
            checked={authenticationMode === 'AAI'}
            classNameRoot="mx-3 my-auto"
            classNameThumb={authenticationMode === 'AAI' && 'translate-x-[1.15rem] transition-transform'}
            onCheckedChange={() =>
              authenticationMode === 'AAI' ? onChangeAuthenticationMode('PASSWORD') : onChangeAuthenticationMode('AAI')
            }
          />
          <div className="my-auto">
            <FormattedMessage defaultMessage="SwitchAAI" id="form.createSession.participantAuth.switchAai.title" />
            <CustomTooltip
              tooltip={intl.formatMessage(messages.switchAAIDescription)}
              tooltipStyle={'max-w-[20%] sm:max-w-[30%] md:max-w-[40%]'}
              triggerStyle={'!ml-2'}
              withArrow={false}
            >
              <Icon className="icon" color="blue" name="question circle" />
            </CustomTooltip>
          </div>
        </div>
      )}
      {/* 
      LIST WITH PARTICIPANTS
      RED highlighted tag to show that something is missing and why
      closing / escape is disabled */}
    </div>
  )
}

export default SessionParticipantSettings
