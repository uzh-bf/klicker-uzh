'use client'

import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import ParticipantDataUseChoices from '@klicker-uzh/shared-components/src/participant/ParticipantDataUseChoices'
import {
  Button,
  Checkbox,
  H1,
  H3,
  Modal,
  UserNotification,
} from '@uzh-bf/design-system'
import { Settings2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { authedFetch } from '../lib/client/authedFetch'
import type { ChatDataUseState } from '../lib/dataUse'

const choicesDataCy = {
  researchYes: 'chat-data-use-research-true',
  researchNo: 'chat-data-use-research-false',
  researchToggle: 'chat-data-use-research-toggle',
  learningAnalyticsYes: 'chat-data-use-analytics-true',
  learningAnalyticsNo: 'chat-data-use-analytics-false',
  learningAnalyticsToggle: 'chat-data-use-analytics-toggle',
  learningAnalyticsPrivacy: 'chat-data-use-privacy-policy',
}

interface DataUseResponse {
  state: ChatDataUseState
}

function dataUseEndpoint(chatbotId: string) {
  return `/api/chatbots/${chatbotId}/data-use`
}

/**
 * Reload the persisted state through the same route the completion writes to.
 * A stale revision can only be answered with the current revision and the
 * choices that belong to it, so the caller decides what to do with a failure.
 */
async function fetchDataUseState(
  chatbotId: string
): Promise<ChatDataUseState | null> {
  try {
    const response = await authedFetch(dataUseEndpoint(chatbotId))
    if (!response.ok) return null
    const data = (await response.json()) as DataUseResponse
    return data.state ?? null
  } catch {
    return null
  }
}

interface ParticipantDataUseGateProps {
  chatbotId: string
  isGuest: boolean
  state: ChatDataUseState
}

/**
 * Blocking onboarding step for a participant account that has not completed the
 * current data-use disclosure. Chat answers on the participant's behalf and
 * stores the exchange on the account, so the acknowledgement and both purpose
 * choices have to exist before the first turn. Anonymous chat is a persisted
 * guest account without personal data, which is why the same step explains the
 * guest account instead of skipping it.
 */
export function ParticipantDataUseGate({
  chatbotId,
  isGuest,
  state,
}: ParticipantDataUseGateProps) {
  const t = useTranslations()
  const router = useRouter()
  const [currentState, setCurrentState] = useState(state)
  const [researchConsent, setResearchConsent] = useState<boolean | undefined>(
    currentState.researchChoiceRecorded ? currentState.researchConsent : true
  )
  const [learningAnalyticsConsent, setLearningAnalyticsConsent] = useState<
    boolean | undefined
  >(
    currentState.learningAnalyticsChoiceRecorded
      ? currentState.learningAnalyticsConsent
      : undefined
  )
  const [acknowledged, setAcknowledged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [conflict, setConflict] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (
      !acknowledged ||
      learningAnalyticsConsent === undefined ||
      saving ||
      conflict
    ) {
      return
    }

    setSaving(true)
    setFailed(false)
    try {
      const response = await authedFetch(dataUseEndpoint(chatbotId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: currentState.dataUseRevision,
          researchConsent,
          learningAnalyticsConsent,
          acknowledged: true,
        }),
      })

      if (!response.ok) {
        const isConflict = response.status === 409
        // A conflicting revision means another session recorded a decision
        // first. Reloading and clearing the local intent keeps this attempt
        // from pairing old choices with the newer revision.
        setConflict(isConflict)
        setFailed(true)
        setAcknowledged(false)
        if (isConflict) {
          const reloaded = await fetchDataUseState(chatbotId)
          if (reloaded) {
            setCurrentState(reloaded)
            setResearchConsent(
              reloaded.researchChoiceRecorded ? reloaded.researchConsent : true
            )
            setLearningAnalyticsConsent(
              reloaded.learningAnalyticsChoiceRecorded
                ? reloaded.learningAnalyticsConsent
                : undefined
            )
            setFailed(false)
          }
          // The server rejects a stale revision, so a repeat attempt can never
          // overwrite the newer decision. Leaving the step blocked when the
          // reload itself failed would only strand the participant; a retry
          // reloads the reported revision again.
          setConflict(false)
        }
        router.refresh()
        return
      }

      router.refresh()
    } catch {
      setFailed(true)
      setAcknowledged(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4 md:p-6">
      <H1>
        {t(isGuest ? 'chat.dataUse.guestTitle' : 'chat.dataUse.accountTitle')}
      </H1>
      <DynamicMarkdown
        withProse
        withLinkButtons={false}
        content={t(
          isGuest ? 'chat.dataUse.guestIntro' : 'chat.dataUse.accountIntro'
        )}
      />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2 rounded md:bg-slate-50 md:p-4">
          <H3 className={{ root: 'mb-0 border-b' }}>
            {t('pwa.createAccount.signup.dataUseTitle')}
          </H3>
          <ParticipantDataUseChoices
            disabled={saving}
            researchConsent={researchConsent}
            learningAnalyticsConsent={learningAnalyticsConsent}
            onResearchConsentChange={setResearchConsent}
            onLearningAnalyticsConsentChange={setLearningAnalyticsConsent}
            dataCy={choicesDataCy}
          />
        </div>
        {failed && (
          <UserNotification type="error">
            {t(
              conflict
                ? 'pwa.profile.dataUseConflict'
                : 'shared.generic.systemError'
            )}
          </UserNotification>
        )}
        <div className="flex flex-col items-start justify-between gap-2 rounded bg-slate-100 p-4 md:flex-row md:items-center md:gap-4">
          <Checkbox
            checked={acknowledged}
            onCheck={() => setAcknowledged(!acknowledged)}
            data={{ cy: 'chat-data-use-acknowledged' }}
            label={
              <DynamicMarkdown
                withProse
                withLinkButtons={false}
                content={t('pwa.createAccount.signup.acknowledgement')}
              />
            }
          />
          <Button
            primary
            type="submit"
            loading={saving}
            disabled={
              !acknowledged ||
              learningAnalyticsConsent === undefined ||
              conflict
            }
            className={{ root: 'w-full flex-none md:w-max' }}
            data={{ cy: 'chat-data-use-submit' }}
          >
            {t('shared.generic.continue')}
          </Button>
        </div>
      </form>
    </div>
  )
}

interface ParticipantDataUseSettingsProps {
  chatbotId: string
}

/**
 * Later changes to the recorded purpose choices. Available to registered
 * participants and to persisted guest accounts, which have the same choices and
 * the same storage.
 */
export function ParticipantDataUseSettings({
  chatbotId,
}: ParticipantDataUseSettingsProps) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<ChatDataUseState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const [conflict, setConflict] = useState(false)

  useEffect(() => {
    if (!open) return

    let active = true
    setLoading(true)
    setFailed(false)
    authedFetch(dataUseEndpoint(chatbotId))
      .then(async (response) => {
        if (!active) return
        if (!response.ok) {
          setFailed(true)
          return
        }
        const data = (await response.json()) as DataUseResponse
        setState(data.state)
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, chatbotId])

  async function updateChoice(
    purpose: 'research' | 'analytics',
    consent: boolean
  ) {
    if (!state) return

    setSaving(true)
    setFailed(false)
    try {
      const response = await authedFetch(dataUseEndpoint(chatbotId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose,
          consent,
          expectedRevision: state.dataUseRevision,
        }),
      })
      if (!response.ok) {
        const isConflict = response.status === 409
        setFailed(true)
        setConflict(isConflict)
        if (isConflict) {
          // Retrying with the stale revision can only fail again, so adopt the
          // revision the server just reported.
          const reloaded = await fetchDataUseState(chatbotId)
          if (reloaded) {
            setState(reloaded)
            setConflict(false)
          }
        }
        return
      }
      const data = (await response.json()) as DataUseResponse
      setState(data.state)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        data-cy="chat-data-use-settings-toggle"
        className="hover:bg-accent focus-visible:ring-ring flex w-full items-center gap-2 border-t px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-1"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="h-4 w-4" />
        <span className="text-base font-medium">
          {t('chat.dataUse.settingsTitle')}
        </span>
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('chat.dataUse.settingsTitle')}
        className={{ content: 'max-w-2xl' }}
      >
        {loading ? (
          <div className="p-4 text-sm">{t('chat.dataUse.settingsLoading')}</div>
        ) : !state ? (
          <UserNotification type="error">
            {t('shared.generic.systemError')}
          </UserNotification>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              {t('chat.dataUse.settingsIntro')}
            </p>
            <ParticipantDataUseChoices
              disabled={saving}
              researchConsent={state.researchConsent}
              learningAnalyticsConsent={
                state.learningAnalyticsChoiceRecorded
                  ? state.learningAnalyticsConsent
                  : undefined
              }
              onResearchConsentChange={(consent) =>
                updateChoice('research', consent)
              }
              onLearningAnalyticsConsentChange={(consent) =>
                updateChoice('analytics', consent)
              }
              dataCy={choicesDataCy}
            />
            {failed && (
              <UserNotification type="error">
                {t(
                  conflict
                    ? 'pwa.profile.dataUseConflict'
                    : 'shared.generic.systemError'
                )}
              </UserNotification>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
