import { faThumbsUp, faTrashCan } from '@fortawesome/free-regular-svg-icons'
import {
  faArrowDown,
  faArrowUp,
  faCheck,
  faComments,
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

  return (
    <div>
      <Button
        className={{
          root: 'bg-primary-10 border-primary-100 flex w-full border border-solid p-2 !pl-4 text-left',
        }}
        onClick={() => setIsEditingActive((prev) => !prev)}
        data={{ cy: `open-feedback-${content}` }}
      >
        <div className="no-page-break-inside flex-1">
          <p className="mt-0">{content}</p>
          <div className="mt-2 flex flex-row flex-wrap items-end text-gray-500">
            <div>{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
            <div className="min-w-max">
              {resolved ? (
                <>
                  <FontAwesomeIcon icon={faCheck} className="ml-2" />
                  {responses && responses.length > 0 && (
                    <div className="ml-7 text-gray-500 md:hidden print:hidden">
                      {t('manage.cockpit.answersGiven', {
                        number: responses.length,
                      })}
                    </div>
                  )}
                </>
              ) : (
                <FontAwesomeIcon icon={faComments} className="ml-2" />
              )}
            </div>
            <div className="ml-4">
              {pinned && <FontAwesomeIcon icon={faThumbTack} />}
            </div>
          </div>
        </div>
        <div className="flex flex-initial flex-col items-end justify-between print:hidden">
          <div className="text-xl text-gray-500">
            {votes} <FontAwesomeIcon icon={faThumbsUp} className="ml-2" />
          </div>
          <div className="mt-2 flex flex-row items-end">
            {responses && responses.length > 0 && (
              <div className="mr-4 hidden text-gray-500 md:block">
                {t('manage.cockpit.answersGiven', {
                  number: responses.length,
                })}
              </div>
            )}
            <Button
              className={{
                root: twMerge(
                  'mr-1 h-9',
                  isBeingDeleted && 'bg-red-600 text-white'
                ),
              }}
              onClick={(e) => {
                e?.stopPropagation()
                if (isBeingDeleted) {
                  onDeleteFeedback()
                } else {
                  setIsBeingDeleted(true)
                }
              }}
              data={{ cy: `delete-feedback-${content}` }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faTrashCan} />
              </Button.Icon>
            </Button>
            <Button
              className={{ root: 'h-9' }}
              icon={isEditingActive ? 'arrow up' : 'arrow down'}
              onClick={(e) => {
                e?.stopPropagation()
                setIsEditingActive((prev) => !prev)
              }}
              data={{ cy: `open-feedback-button-${content}` }}
            >
              {isEditingActive ? (
                <Button.Icon>
                  <FontAwesomeIcon icon={faArrowUp} />
                </Button.Icon>
              ) : (
                <Button.Icon>
                  <FontAwesomeIcon icon={faArrowDown} />
                </Button.Icon>
              )}
            </Button>
          </div>
        </div>
      </Button>

      <div
        className={twMerge(
          'border border-t-0 border-solid border-gray-300 p-4 print:border-0 print:p-2 print:pr-0',
          !isEditingActive && 'hidden print:block'
        )}
      >
        <div>
          {responses &&
            responses.map((response) => (
              <div
                className="no-page-break-inside mt-2 flex flex-row items-start rounded border border-l-[5px] border-solid bg-gray-50 py-1 pl-4 shadow-sm first:mt-0 last:mb-4 print:border-l-[10px] print:pr-0"
                key={response.createdAt}
              >
                <div className="flex-1">
                  <p className="prose mb-0">{response.content}</p>
                  <div className="mt-1 text-sm text-gray-500">
                    {dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}
                  </div>
                </div>
                <div className="flex flex-initial flex-row items-center print:hidden">
                  <div className={twMerge('text-gray-500')}>
                    {response.positiveReactions}{' '}
                    <FontAwesomeIcon icon={faThumbsUp} className="mr-0.5" />
                  </div>
                  <div className={twMerge('ml-2', 'text-gray-500')}>
                    {response.negativeReactions}{' '}
                    <FontAwesomeIcon icon={faQuestion} className="mr-0.5" />
                  </div>
                  <div className="ml-2 print:hidden">
                    <Button
                      className={{ root: 'mr-1 h-9 w-9 justify-center' }}
                      onClick={() => onDeleteResponse(response.id)}
                      data={{ cy: `delete-response-${response.content}` }}
                    >
                      <Button.Icon>
                        <FontAwesomeIcon icon={faTrashCan} />
                      </Button.Icon>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
        </div>
        <div className="flex print:hidden">
          <div className="flex-1">
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
              {({ isSubmitting }) => (
                <div className="flex-1">
                  <Form>
                    <FormikTextareaField
                      className={{
                        input: twMerge(
                          'border-uzh-grey-80 mb-1 w-full rounded-md border-2 border-solid bg-white p-1.5 text-sm',
                          resolved && 'bg-gray-100 opacity-50'
                        ),
                        root: 'mb-1',
                      }}
                      rows="3"
                      name="respondToFeedbackInput"
                      placeholder={
                        resolved
                          ? t('manage.cockpit.reopenToAnswer')
                          : t('manage.cockpit.insertResponseHere')
                      }
                      disabled={resolved}
                      maxLength={1000}
                      maxLengthLabel={t('shared.generic.characters')}
                      data={{ cy: `respond-to-feedback-${content}` }}
                    />
                    <Button
                      className={{
                        root: 'bg-primary-80 float-right px-5 text-white disabled:opacity-60',
                      }}
                      type="submit"
                      disabled={isSubmitting || resolved}
                      data={{ cy: `submit-feedback-response-${content}` }}
                    >
                      <Button.Icon className={{ root: 'mr-1' }}>
                        <FontAwesomeIcon icon={faPaperPlane} />
                      </Button.Icon>
                      <Button.Label>{t('shared.generic.respond')}</Button.Label>
                    </Button>
                  </Form>
                </div>
              )}
            </Formik>
          </div>
          <div className="flex flex-initial flex-col gap-2 pl-4">
            <Button
              className={{ root: 'px-5' }}
              disabled={resolved}
              onClick={() => onPinFeedback(!pinned)}
              data={{ cy: `pin-feedback-${content}` }}
            >
              <Button.Icon className={{ root: 'mr-1' }}>
                <FontAwesomeIcon icon={faThumbTack} />
              </Button.Icon>
              <Button.Label>
                {pinned
                  ? t('manage.cockpit.unpinFeedback')
                  : t('manage.cockpit.pinFeedback')}
              </Button.Label>
            </Button>
            <Button
              className={{ root: 'px-5' }}
              icon={resolved ? 'lock open' : 'lock'}
              onClick={() => {
                onResolveFeedback(!resolved)
                if (!resolved) {
                  setIsEditingActive(false)
                }
              }}
              data={{ cy: `resolve-feedback-${content}` }}
            >
              {resolved ? (
                <Button.Icon className={{ root: 'mr-1' }}>
                  <FontAwesomeIcon icon={faLockOpen} />
                </Button.Icon>
              ) : (
                <Button.Icon className={{ root: 'mr-1' }}>
                  <FontAwesomeIcon icon={faLock} />
                </Button.Icon>
              )}
              {resolved
                ? t('manage.cockpit.reopen')
                : t('manage.cockpit.resolve')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Feedback
