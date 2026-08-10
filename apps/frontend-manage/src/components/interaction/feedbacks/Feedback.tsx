import { faThumbsUp, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowDown,
  faArrowUp,
  faCheck,
  faComment,
  faLock,
  faLockOpen,
  faPaperPlane,
  faQuestion,
  faThumbTack,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { FeedbackResponse } from '@klicker-uzh/graphql/dist/ops'
import { Button, FormikTextareaField } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import FeedbackDeletionModal from './FeedbackDeletionModal'

interface IFeedback {
  id: number
  content: string
  createdAt: string
  votes: number
  resolved: boolean
  pinned: boolean
  responses?: FeedbackResponse[]
  resolvedAt: string
}

interface Props extends IFeedback {
  onDeleteFeedback: () => void
  onPinFeedback: (pinState: boolean) => void
  onResolveFeedback: (resolvedState: boolean) => void
  onRespondToFeedback: (feebdackId: number, response: string) => void
  onDeleteResponse: (responseId: number) => void
}

function Feedback({
  id,
  content,
  createdAt,
  votes,
  resolved,
  pinned,
  responses,
  onDeleteFeedback,
  onDeleteResponse,
  onPinFeedback,
  onResolveFeedback,
  onRespondToFeedback,
}: Props) {
  const t = useTranslations()
  const [isEditingActive, setIsEditingActive] = useState(false)
  const [isBeingDeleted, setIsBeingDeleted] = useState(false)
  const [showDeletionModal, setShowDeletionModal] = useState(false)

  return (
    <div className="rounded-md border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <div className="p-4 pb-2.5">
        <div className="flex w-full flex-row items-start justify-between">
          <button
            type="button"
            aria-expanded={isEditingActive}
            className="flex-1 cursor-pointer pr-4 text-left transition-colors hover:bg-gray-50"
            onClick={() => setIsEditingActive((prev) => !prev)}
            data-cy={`open-feedback-${content}`}
          >
            <span className="mb-2 block text-base text-gray-900">
              {content}
            </span>
            <span className="flex flex-row flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <span>{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</span>
              </span>
              <span className="flex items-center gap-1">
                {resolved ? (
                  <>
                    <FontAwesomeIcon
                      icon={faCheck}
                      className="text-green-700"
                    />
                    <span className="text-green-700">
                      {t('manage.cockpit.filterSolved')}
                    </span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon
                      icon={faComment}
                      className="text-orange-500"
                    />
                    <span className="text-orange-500">
                      {t('manage.cockpit.filterOpen')}
                    </span>
                  </>
                )}
              </span>
              {pinned && (
                <span className="flex items-center gap-1">
                  <FontAwesomeIcon
                    icon={faThumbTack}
                    className="text-primary-100"
                  />
                  <span className="text-primary-100">
                    {t('manage.cockpit.filterPinned')}
                  </span>
                </span>
              )}
              {responses && responses.length > 0 && (
                <span className="hidden items-center gap-1 md:flex">
                  <span>
                    {t('manage.cockpit.answersGiven', {
                      number: responses.length,
                    })}
                  </span>
                </span>
              )}
            </span>
          </button>

          <div className="-mt-1 flex h-full flex-col items-end justify-between print:hidden">
            <div className="flex flex-row items-center gap-3">
              <div className="flex items-center gap-1 text-lg text-gray-600">
                <span>{votes}</span>
                <FontAwesomeIcon icon={faThumbsUp} />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  basic
                  onClick={(e) => {
                    e?.stopPropagation()
                    setShowDeletionModal(true)
                  }}
                  className={{
                    root: 'h-8 w-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-600',
                  }}
                  data={{ cy: `delete-feedback-${content}` }}
                >
                  <Button.Icon withoutLabel icon={faTrashCan} />
                </Button>
              </div>
            </div>
            <Button
              basic
              onClick={(e) => {
                e?.stopPropagation()
                setIsEditingActive((prev) => !prev)
              }}
              className={{
                root: 'h-8 w-8 text-gray-600 hover:bg-gray-100',
              }}
              data={{ cy: `open-feedback-button-${content}` }}
            >
              <Button.Icon
                withoutLabel
                icon={isEditingActive ? faArrowUp : faArrowDown}
              />
            </Button>
          </div>
        </div>
      </div>
      <div
        className={twMerge(
          'border-t border-gray-200 bg-gray-50 print:border-0 print:p-2 print:pr-0',
          !isEditingActive && 'hidden print:block'
        )}
      >
        <div className="space-y-2 p-3">
          {responses &&
            responses.map((response) => (
              <div
                className="no-page-break-inside rounded-lg border border-gray-200 bg-white p-3 shadow-sm print:border-l-4 print:border-l-blue-400"
                key={response.createdAt}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="mb-1 text-gray-900">{response.content}</p>
                    <div className="text-sm text-gray-500">
                      {dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 print:hidden">
                    <div className="flex items-center gap-1 text-base text-gray-500">
                      <span>{response.positiveReactions}</span>
                      <FontAwesomeIcon
                        icon={faThumbsUp}
                        className="text-green-700"
                      />
                    </div>
                    <div className="flex items-center gap-1 text-base text-gray-500">
                      <span>{response.negativeReactions}</span>
                      <FontAwesomeIcon
                        icon={faQuestion}
                        className="text-orange-500"
                      />
                    </div>
                    <Button
                      basic
                      className={{
                        root: 'h-8 w-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-600',
                      }}
                      onClick={() => onDeleteResponse(response.id)}
                      data={{ cy: `delete-response-${response.content}` }}
                    >
                      <Button.Icon withoutLabel icon={faTrashCan} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

          <div className="flex w-full flex-col items-end print:hidden">
            <div className="flex flex-row gap-1.5">
              <Button
                basic
                className={{
                  root: 'text-primary-100 hover:text-primary-100 mb-0.5 py-1',
                }}
                disabled={resolved}
                onClick={() => onPinFeedback(!pinned)}
                data={{ cy: `pin-feedback-${content}` }}
              >
                <Button.Icon icon={faThumbTack} />
                <Button.Label>
                  {pinned
                    ? t('manage.cockpit.unpinFeedback')
                    : t('manage.cockpit.pinFeedback')}
                </Button.Label>
              </Button>
              <Button
                basic
                className={{
                  root: 'text-primary-100 hover:text-primary-100 mb-0.5 px-3 py-1',
                }}
                onClick={() => {
                  onResolveFeedback(!resolved)
                  if (!resolved) {
                    setIsEditingActive(false)
                  }
                }}
                data={{ cy: `resolve-feedback-${content}` }}
              >
                <Button.Icon icon={resolved ? faLockOpen : faLock} />
                <Button.Label>
                  {resolved
                    ? t('manage.cockpit.reopen')
                    : t('manage.cockpit.resolve')}
                </Button.Label>
              </Button>
            </div>
            <Formik
              initialValues={{ respondToFeedbackInput: '' }}
              onSubmit={(values, { setSubmitting }) => {
                if (values.respondToFeedbackInput !== '') {
                  onRespondToFeedback(id, values.respondToFeedbackInput)
                  values.respondToFeedbackInput = ''

                  setTimeout(() => {
                    setSubmitting(false)
                  }, 700)
                } else {
                  setSubmitting(false)
                }
              }}
            >
              {({ values, isSubmitting }) => (
                <Form className="w-full">
                  <FormikTextareaField
                    className={{
                      input: twMerge(
                        'w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                        resolved && 'bg-gray-100 opacity-50'
                      ),
                      root: 'w-full',
                    }}
                    rows="3"
                    name="respondToFeedbackInput"
                    placeholder={
                      resolved
                        ? t('manage.cockpit.reopenToAnswer')
                        : t('manage.cockpit.enterResponseHere')
                    }
                    disabled={resolved}
                    maxLength={1000}
                    maxLengthLabel={t('shared.generic.characters')}
                    data={{ cy: `respond-to-feedback-${content}` }}
                  />
                  <div className="flex justify-end">
                    <Button
                      primary
                      type="submit"
                      disabled={
                        isSubmitting ||
                        resolved ||
                        values.respondToFeedbackInput === ''
                      }
                      className={{ root: 'mt-1 h-8' }}
                      data={{ cy: `submit-feedback-response-${content}` }}
                    >
                      <Button.Icon icon={faPaperPlane} />
                      <Button.Label>{t('shared.generic.respond')}</Button.Label>
                    </Button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>

      {showDeletionModal && (
        <FeedbackDeletionModal
          open={showDeletionModal}
          onClose={() => setShowDeletionModal(false)}
          onConfirm={async () => {
            setIsBeingDeleted(true)
            try {
              await new Promise<void>((resolve) => {
                onDeleteFeedback()
                resolve()
              })
              setShowDeletionModal(false)
            } finally {
              setIsBeingDeleted(false)
            }
          }}
          feedbackContent={content}
          loading={isBeingDeleted}
        />
      )}
    </div>
  )
}

export default Feedback
