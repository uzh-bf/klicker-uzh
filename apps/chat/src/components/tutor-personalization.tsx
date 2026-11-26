'use client'

import DynamicMarkdown from '@klicker-uzh/shared-components/src/evaluation/DynamicMarkdown'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { authedFetch } from '../lib/client/authedFetch'
import type { ChatDataUseState } from '../lib/dataUse'
import { useSettingsStore } from '../stores/settingsStore'

/** Fired after any data-use choice is saved, so open surfaces can re-read. */
export const DATA_USE_CHANGED_EVENT = 'klicker-chat-data-use-changed'

/**
 * "Decide later" records nothing on the account. The browser remembers it so
 * the card stays away; the choice remains available in the data-use settings.
 */
const OFFER_LATER_KEY = 'klicker-chat-tutor-personalization-later'
/** The same for the later question about learning notes. */
const NOTES_OFFER_LATER_KEY = 'klicker-chat-tutor-personalization-notes-later'

function offerPostponed(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function postponeOffer(key: string) {
  try {
    window.localStorage.setItem(key, 'true')
  } catch {
    // Without storage the card returns on the next visit, which is harmless.
  }
}

async function readDataUseState(
  chatbotId: string
): Promise<ChatDataUseState | null> {
  try {
    const response = await authedFetch(`/api/chatbots/${chatbotId}/data-use`)
    if (!response.ok) return null
    return ((await response.json()) as { state: ChatDataUseState }).state
  } catch {
    return null
  }
}

/**
 * Offer the optional personalization choice where it is used. The card shows
 * only while the choice is unanswered, in a chatbot whose lecturer switched
 * personalization on and that has the Tutor mode. Yes, no and "decide later"
 * carry equal weight, and nothing is preselected.
 *
 * A student who agreed before the deployment kept learning notes is asked
 * once more, about the notes only. Their earlier yes stays as it is unless
 * they agree; switching personalization off remains in the settings.
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
  const [notesPostponed, setNotesPostponed] = useState(true)
  const [showNotice, setShowNotice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const offered = chatbotEnabled && tutorAvailable

  useEffect(() => {
    if (!offered) return
    setPostponed(offerPostponed(OFFER_LATER_KEY))
    setNotesPostponed(offerPostponed(NOTES_OFFER_LATER_KEY))

    let active = true
    const load = () =>
      readDataUseState(chatbotId).then((loaded) => {
        if (active) setState(loaded)
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
        authedFetch(`/api/chatbots/${chatbotId}/data-use`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purpose: 'personalization',
            consent,
            expectedRevision,
            disclosureVersion: state.tutorPersonalizationCurrentVersion,
          }),
        })
      try {
        let response = await save(state.dataUseRevision)
        if (response.status === 409) {
          // Another surface changed a choice meanwhile. Retry once on the
          // current revision, unless that change already answered this one.
          const current = await readDataUseState(chatbotId)
          if (!current) {
            setFailed(true)
            return
          }
          if (
            current.tutorPersonalizationConsent !==
            state.tutorPersonalizationConsent
          ) {
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

  if (!offered || !state?.complete) return null

  const notice = state.tutorPersonalizationNotesOffered
    ? `${t('shared.tutorPersonalization.notice')}\n\n${t('shared.tutorPersonalization.noticeNotes')}`
    : t('shared.tutorPersonalization.notice')

  if (
    state.tutorPersonalizationConsent === true &&
    state.tutorPersonalizationNotesOffered &&
    !state.tutorPersonalizationNotesAgreed &&
    !notesPostponed
  ) {
    return (
      <section
        aria-labelledby="tutor-personalization-notes-offer-title"
        data-cy="chat-personalization-notes-offer"
        className="bg-background shrink-0 border-b px-4 py-3"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          <h2
            id="tutor-personalization-notes-offer-title"
            className="text-base font-semibold"
          >
            {t('chat.personalization.reofferTitle')}
          </h2>
          <p className="text-sm">{t('chat.personalization.reofferLead')}</p>
          <div className="prose prose-sm max-w-none">
            <DynamicMarkdown
              withLinkButtons={false}
              content={t('shared.tutorPersonalization.noticeNotes')}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={saving}
              data={{ cy: 'chat-personalization-notes-offer-yes' }}
              onClick={() => void answer(true)}
            >
              {t('chat.personalization.reofferYes')}
            </Button>
            <Button
              type="button"
              disabled={saving}
              data={{ cy: 'chat-personalization-notes-offer-keep' }}
              onClick={() => {
                postponeOffer(NOTES_OFFER_LATER_KEY)
                setNotesPostponed(true)
              }}
            >
              {t('chat.personalization.reofferKeep')}
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

  if (postponed || state.tutorPersonalizationConsent !== null) return null

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
        <p className="text-sm">
          {t(
            state.tutorPersonalizationNotesOffered
              ? 'chat.personalization.offerLeadNotes'
              : 'chat.personalization.offerLead'
          )}
        </p>
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
              <DynamicMarkdown withLinkButtons={false} content={notice} />
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
              postponeOffer(OFFER_LATER_KEY)
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
  | { active: true; text: string; notes: string }
  | { active: false; reason: string }

/** Notes exist, or may exist, for this student in this chatbot's course. */
const NOTES_IN_USE = ['present', 'empty', 'unavailable']

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
  const [confirmingDeletion, setConfirmingDeletion] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletion, setDeletion] = useState<
    'deleted' | 'pending' | 'failed' | null
  >(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const response = await authedFetch(
        `/api/chatbots/${chatbotId}/learner-context`
      )
      if (!response.ok) {
        setFailed(true)
        return
      }
      setView((await response.json()) as LearnerContextView)
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
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

  const deleteNotes = useCallback(async () => {
    setDeleting(true)
    setDeletion(null)
    try {
      const response = await authedFetch(
        `/api/chatbots/${chatbotId}/learner-context`,
        { method: 'DELETE' }
      )
      const status = response.ok
        ? ((await response.json()) as { status: string }).status
        : null
      setDeletion(
        status === 'deleted'
          ? 'deleted'
          : status === 'pending'
            ? 'pending'
            : 'failed'
      )
      setConfirmingDeletion(false)
      await load()
    } catch {
      setDeletion('failed')
    } finally {
      setDeleting(false)
    }
  }, [chatbotId, load])

  const notes = view?.active ? view.notes : null
  const notesMessage =
    notes === 'unavailable'
      ? t('chat.personalization.notesUnavailable')
      : notes === 'deleting' && deletion === null
        ? t('chat.personalization.notesDeleting')
        : notes === 'empty' && deletion === null
          ? t('chat.personalization.notesEmpty')
          : null

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
          {!failed && notesMessage && (
            <p data-cy="chat-personalization-notes-state">{notesMessage}</p>
          )}
          {deletion && (
            <p data-cy="chat-personalization-notes-deletion">
              {deletion === 'deleted'
                ? t('chat.personalization.notesDeleted')
                : deletion === 'pending'
                  ? t('chat.personalization.notesDeletePending')
                  : t('shared.generic.systemError')}
            </p>
          )}
          {!failed &&
            notes !== null &&
            NOTES_IN_USE.includes(notes) &&
            (confirmingDeletion ? (
              <div className="flex flex-col gap-2 rounded border p-2">
                <p>{t('chat.personalization.notesDeleteConfirm')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={deleting}
                    data={{ cy: 'chat-personalization-notes-delete-confirm' }}
                    onClick={() => void deleteNotes()}
                  >
                    {t('chat.personalization.notesDeleteYes')}
                  </Button>
                  <Button
                    type="button"
                    disabled={deleting}
                    onClick={() => setConfirmingDeletion(false)}
                  >
                    {t('chat.personalization.notesDeleteCancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button
                  type="button"
                  data={{ cy: 'chat-personalization-notes-delete' }}
                  onClick={() => {
                    setDeletion(null)
                    setConfirmingDeletion(true)
                  }}
                >
                  {t('chat.personalization.notesDelete')}
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
