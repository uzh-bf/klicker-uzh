/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react'
import { Icon } from 'semantic-ui-react'
import { useIntl, defineMessages, FormattedMessage } from 'react-intl'
import clsx from 'clsx'

import CustomSwitch from '../../common/CustomSwitch'
import CustomTooltip from '../../common/CustomTooltip'
import CustomCheckbox from '../../common/CustomCheckbox'
import CustomButton from '../../common/CustomButton'

export type AuthenticationMode = 'NONE' | 'PASSWORD' | 'AAI'

const messages = defineMessages({
  participantAuthentication: {
    defaultMessage: 'Participant Authentication',
    id: 'form.createSession.participantAuth.string.participantAuthentication',
  },
  participantsPlaceholder: {
    defaultMessage: 'Input your participants (each on a new line)',
    id: 'form.createSession.participantAuth.string.participantsPlaceholder',
  },
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
  emptyParticipantListError: {
    defaultMessage:
      'Authentication cannot be enabled with an empty participant lists. Please add participants or disable authentication.',
    id: 'form.createSession.settings.errors.participantAuth',
  },
})

interface SessionParticipantSettingProps {
  isAuthenticationEnabled: boolean
  onChangeIsAuthenticationEnabled: (newValue: boolean) => void
  participants: string[]
  onChangeParticipants: (participants: string[]) => void
  onChangeAuthenticationMode: (mode: AuthenticationMode) => void
  authenticationMode: AuthenticationMode
  addError: (newError: string) => void
  removeError: (error: string) => void
}

function SessionParticipantSettings({
  isAuthenticationEnabled,
  onChangeIsAuthenticationEnabled,
  participants,
  onChangeParticipants,
  onChangeAuthenticationMode,
  authenticationMode,
  addError,
  removeError,
}: SessionParticipantSettingProps): React.ReactElement {
  const intl = useIntl()
  const [participantsRaw, setParticipantsRaw] = useState('')

  const onChangeAuthenticationEnabled = (): void => {
    // if authentication will be disabled, reset the participants
    if (isAuthenticationEnabled) {
      onChangeParticipants([])
      onChangeAuthenticationMode(null)
    }
    onChangeIsAuthenticationEnabled(!isAuthenticationEnabled)
  }

  const onParseParticipants = (): void => {
    try {
      const participantList = participantsRaw
        .replace(/;|,/g, '\n')
        .split('\n')
        .map((participant) => participant.replace(/ /g, ''))
        .filter((item, pos, self) => self.indexOf(item) === pos)
      onChangeParticipants(participantList)
    } catch (e) {
      console.error(e)
    }
  }

  const getParticipants = (participantList: any): string => {
    return participantList.join('\n')
  }

  useEffect(() => {
    setParticipantsRaw(getParticipants(participants))
    if (isAuthenticationEnabled && participants.length === 0) {
      addError(intl.formatMessage(messages.emptyParticipantListError))
    } else if (!isAuthenticationEnabled || participants.length !== 0) {
      removeError(intl.formatMessage(messages.emptyParticipantListError))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticationEnabled, participants])

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
          }}
        />
        <div className="h-full my-auto font-bold">{intl.formatMessage(messages.participantAuthentication)}</div>
      </div>

      {isAuthenticationEnabled && (
        <div className="flex flex-row h-10 ml-7 py-auto">
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

      {isAuthenticationEnabled && (
        <div className="ml-7">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <form className="w-full text-right">
              <div>
                <textarea
                  className="w-full text-start !unset p-3 mb-2 border border-solid border-grey-40 rounded-md"
                  name="name"
                  placeholder={intl.formatMessage(messages.participantsPlaceholder)}
                  rows={10}
                  value={participantsRaw}
                  onChange={(e): void => setParticipantsRaw(e.target.value as string)}
                />
              </div>
              <CustomButton
                className={clsx('p-3 font-bold', participants.length === 0 && 'text-white bg-red-600')}
                onClick={onParseParticipants}
              >
                <FormattedMessage
                  defaultMessage="Update Participants"
                  id="form.createSession.participantAuth.button.updateParticipants"
                />
              </CustomButton>
            </form>
            <div className="max-h-full border border-solid rounded-md h-max border-grey-40">
              <div className="p-3 font-bold border-0 border-b border-solid bg-grey-20 border-grey-">
                <FormattedMessage
                  defaultMessage="Participants"
                  id="form.createSession.participantAuth.string.participants"
                />
                : {participants.length}
              </div>
              <div className="overflow-y-scroll h-72">
                {participants.map((participant) => (
                  <div className="p-3 border-0 border-b border-solid border-grey-40 last:border-b-0" key={participant}>
                    {participant}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SessionParticipantSettings
