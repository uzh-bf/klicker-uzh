'use client'

import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { TUTOR_PERSONALIZATION_DISCLOSURE_VERSION } from '@klicker-uzh/util/participant-account-data-use'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { authedFetch } from '../lib/client/authedFetch'
import {
  DATA_USE_CHANGED_EVENT,
  dataUseEndpoint,
  fetchDataUseState,
} from '../lib/client/dataUse'
import type { ChatDataUseState } from '../lib/dataUse'
import { useSettingsStore } from '../stores/settingsStore'

/**
 * "Decide later" records nothing on the account. The browser remembers it so
 * the card stays away; the choice remains available in the data-use settings.
 */
const OFFER_LATER_KEY = 'klicker-chat-tutor-personalization-later'

function offerPostponed(): boolean {
  try {
    return window.localStorage.getItem(OFFER_LATER_KEY) === 'true'
  } catch {
    return false
  }
}

function postponeOffer() {
  try {
    window.localStorage.setItem(OFFER_LATER_KEY, 'true')
  } catch {
    // Without storage the card returns on the next visit, which is harmless.
  }
}

/**
 * Offer the optional personalization choice where it is used. The card shows
 * only while the choice is unanswered, in a chatbot whose lecturer switched
 * personalization on and that has the Tutor mode. Yes, no and "decide later"
 * carry equal weight, and nothing is preselected.
 */
export function TutorPersonalizationOffer({
  chatbotId,
  tutorAvailable,
}: {
  chatbotId: string
  tutorAvailable: boolean
}) {
  const t = useTranslations()
  const chatbotEnabled = useSettingsStore(
    (state) => state.personalizationEnabled
  )
  const [state, setState] = useState<ChatDataUseState | null>(null)
  const [postponed, setPostponed] = useState(true)
  const [showNotice, setShowNotice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const offered = chatbotEnabled && tutorAvailable

  useEffect(() => {
    if (!offered) return
    setPostponed(offerPostponed())

    let active = true
    const load = () =>
      fetchDataUseState(chatbotId).then((loaded) => {
        // A failed re-read keeps the last known state, so an unanswered offer
        // does not vanish on a passing error.
        if (active && loaded) setState(loaded)
      })
    void load()
    window.addEventListener(DATA_USE_CHANGED_EVENT, load)
    return () => {
      active = false
      window.removeEventListener(DATA_USE_CHANGED_EVENT, load)
    }
  }, [offered, chatbotId])

  const answer = useCallback(
    async (consent: boolean) => {
      if (!state) return
      setSaving(true)
      setFailed(false)
      const save = (expectedRevision: number) =>
        authedFetch(dataUseEndpoint(chatbotId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purpose: 'personalization',
            consent,
            expectedRevision,
            disclosureVersion: TUTOR_PERSONALIZATION_DISCLOSURE_VERSION,
          }),
        })
      try {
        let response = await save(state.dataUseRevision)
        if (response.status === 409) {
          // Another surface changed a choice meanwhile. Retry once on the
          // current revision, unless that change already answered this one.
          const current = await fetchDataUseState(chatbotId)
          if (!current) {
            setFailed(true)
            return
          }
          if (current.tutorPersonalizationConsent !== null) {
            setState(current)
            return
          }
          response = await save(current.dataUseRevision)
        }
        if (!response.ok) {
          setFailed(true)
          return
        }
        setState(((await response.json()) as { state: ChatDataUseState }).state)
        window.dispatchEvent(new Event(DATA_USE_CHANGED_EVENT))
      } catch {
        setFailed(true)
      } finally {
        setSaving(false)
      }
    },
    [state, chatbotId]
  )

  if (
    !offered ||
    postponed ||
    !state?.complete ||
    state.tutorPersonalizationConsent !== null
  ) {
    return null
  }

  return (
    <section
      aria-labelledby="tutor-personalization-offer-title"
      data-cy="chat-personalization-offer"
      className="bg-background shrink-0 border-b px-4 py-3"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <h2
          id="tutor-personalization-offer-title"
          className="text-base font-semibold"
        >
          {t('chat.personalization.offerTitle')}
        </h2>
        <p className="text-sm">{t('chat.personalization.offerLead')}</p>
        <div>
          <button
            type="button"
            className="text-sm underline underline-offset-2"
            aria-expanded={showNotice}
            aria-controls="tutor-personalization-offer-notice"
            data-cy="chat-personalization-offer-details"
            onClick={() => setShowNotice((shown) => !shown)}
          >
            {t(
              showNotice
                ? 'chat.personalization.offerHideDetails'
                : 'chat.personalization.offerShowDetails'
            )}
          </button>
          {showNotice && (
            <div
              id="tutor-personalization-offer-notice"
              className="prose prose-sm mt-2 max-w-none"
            >
              <DynamicMarkdown
                withLinkButtons={false}
                content={t('shared.tutorPersonalization.notice')}
              />
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={saving}
            data={{ cy: 'chat-personalization-offer-yes' }}
            onClick={() => void answer(true)}
          >
            {t('shared.tutorPersonalization.yes')}
          </Button>
          <Button
            type="button"
            disabled={saving}
            data={{ cy: 'chat-personalization-offer-no' }}
            onClick={() => void answer(false)}
          >
            {t('shared.tutorPersonalization.no')}
          </Button>
          <Button
            type="button"
            disabled={saving}
            data={{ cy: 'chat-personalization-offer-later' }}
            onClick={() => {
              postponeOffer()
              setPostponed(true)
            }}
          >
            {t('chat.personalization.offerLater')}
          </Button>
        </div>
        {failed && (
          <UserNotification type="error">
            {t('shared.generic.systemError')}
          </UserNotification>
        )}
      </div>
    </section>
  )
}

type LearnerContextView =
  | { active: true; text: string }
  | { active: false; reason: string }

/**
 * Lets the student read what the Tutor would receive about them with their
 * next message. The text comes from the same resolution a chat turn uses and
 * is shown unchanged.
 */
export function TutorLearnerContextView({ chatbotId }: { chatbotId: string }) {
  const t = useTranslations()
  const [view, setView] = useState<LearnerContextView | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)

  // Two choices saved in quick succession start two reads. Only the newest
  // one may answer, so the view never shows a state that no longer holds.
  const latestLoad = useRef(0)

  const load = useCallback(async () => {
    const current = ++latestLoad.current
    const isLatest = () => current === latestLoad.current
    setLoading(true)
    setFailed(false)
    try {
      const response = await authedFetch(
        `/api/chatbots/${chatbotId}/learner-context`
      )
      if (!isLatest()) return
      if (!response.ok) {
        setFailed(true)
        return
      }
      const loaded = (await response.json()) as LearnerContextView
      if (isLatest()) setView(loaded)
    } catch {
      if (isLatest()) setFailed(true)
    } finally {
      if (isLatest()) setLoading(false)
    }
  }, [chatbotId])

  // A changed choice changes what the Tutor receives, so re-read while open.
  useEffect(() => {
    if (!open) return
    void load()
    const reload = () => void load()
    window.addEventListener(DATA_USE_CHANGED_EVENT, reload)
    return () => window.removeEventListener(DATA_USE_CHANGED_EVENT, reload)
  }, [open, load])

  const inactiveMessage =
    view && !view.active
      ? view.reason === 'chatbot-disabled'
        ? t('chat.personalization.viewChatbotOff')
        : t('chat.personalization.viewNoConsent')
      : null

  return (
    <div className="flex flex-col gap-2 rounded border p-3">
      <div>
        <Button
          type="button"
          data={{ cy: 'chat-personalization-view-toggle' }}
          aria-expanded={open}
          onClick={() => setOpen((shown) => !shown)}
        >
          {t(
            open
              ? 'chat.personalization.viewHide'
              : 'chat.personalization.viewShow'
          )}
        </Button>
      </div>
      {open && (
        <div
          role="status"
          data-cy="chat-personalization-view"
          className="flex flex-col gap-2 text-sm"
        >
          {loading && !view ? (
            <p>{t('chat.personalization.viewLoading')}</p>
          ) : failed ? (
            <UserNotification type="error">
              {t('shared.generic.systemError')}
            </UserNotification>
          ) : inactiveMessage ? (
            <p>{inactiveMessage}</p>
          ) : view?.active && view.text === '' ? (
            <p>{t('chat.personalization.viewEmpty')}</p>
          ) : view?.active ? (
            <>
              <p>{t('chat.personalization.viewIntro')}</p>
              <pre
                lang="en"
                className="bg-muted max-h-72 overflow-auto rounded p-3 text-xs whitespace-pre-wrap"
              >
                {view.text}
              </pre>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
