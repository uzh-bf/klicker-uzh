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
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { Field, Form, Formik, useFormik } from 'formik'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Yup from 'yup'

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
  const [isEditingActive, setIsEditingActive] = useState(false)
  const [isBeingDeleted, setIsBeingDeleted] = useState(false)

  const formik = useFormik({
    initialValues: {
      response: '',
    },
    validationSchema: Yup.object().shape({
      response: Yup.string().min(1).required(),
    }),
    onSubmit: (values, { resetForm }) => {
      onRespondToFeedback(id, values.response)
      resetForm()
    },
  })

  return (
    <div>
      <Button
        className="w-full text-left flex !pl-4 p-2 border bg-primary-10 border-solid  border-primary"
        onClick={() => setIsEditingActive((prev) => !prev)}
      >
        <div className="flex-1 no-page-break-inside">
          <p className="mt-0">{content}</p>
          <div className="flex flex-row flex-wrap items-end mt-2 text-gray-500">
            <div>{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
            <div className="min-w-max">
              {resolved ? (
                <>
                  <FontAwesomeIcon icon={faCheck} className="ml-2" />
                  {responses && responses.length > 0 && (
                    <div className="text-gray-500 ml-7 md:hidden print:hidden">
                      {responses.length} Antworten gegeben
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
        <div className="flex flex-col items-end justify-between flex-initial print:hidden">
          <div className="text-xl text-gray-500">
            {votes} <FontAwesomeIcon icon={faThumbsUp} className="ml-2" />
          </div>
          <div className="flex flex-row items-end mt-2">
            {responses && responses.length > 0 && (
              <div className="hidden mr-4 text-gray-500 md:block">
                {responses.length} Antworten gegeben
              </div>
            )}
            <Button
              className={twMerge(
                'mr-1 h-9',
                isBeingDeleted && 'bg-red-600 text-white'
              )}
              onClick={(e) => {
                e?.stopPropagation()
                if (isBeingDeleted) {
                  onDeleteFeedback()
                } else {
                  setIsBeingDeleted(true)
                }
              }}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faTrashCan} />
              </Button.Icon>
            </Button>
            <Button
              className="h-9"
              icon={isEditingActive ? 'arrow up' : 'arrow down'}
              onClick={(e) => {
                e?.stopPropagation()
                setIsEditingActive((prev) => !prev)
              }}
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
          'p-4 print:p-2 print:pr-0 border print:border-0 border-t-0 border-gray-300 border-solid',
          !isEditingActive && 'hidden print:block'
        )}
      >
        <div>
          {responses &&
            responses.map((response) => (
              <div
                className="flex flex-row pl-4 mt-2 border border-solid border-l-[5px] print:border-l-[10px] first:mt-0 last:mb-4 items-start bg-gray-50 py-1 print:pr-0 rounded shadow-sm no-page-break-inside"
                key={response.createdAt}
              >
                <div className="flex-1">
                  <p className="mb-0 prose">{response.content}</p>
                  <div className="mt-1 text-sm text-gray-500">
                    {dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}
                  </div>
                </div>
                <div className="flex flex-row items-center flex-initial print:hidden">
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
                      className="justify-center mr-1 w-9 h-9"
                      onClick={() => onDeleteResponse(response.id)}
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
                    <Field
                      className={twMerge(
                        'w-full mb-1 border-2 border-solid border-uzh-grey-80 rounded-md p-1.5 text-sm',
                        resolved && 'bg-gray-100 opacity-50'
                      )}
                      component="textarea"
                      rows="3"
                      name="respondToFeedbackInput"
                      placeholder={
                        resolved
                          ? 'Reopen the feedback to add a new response...'
                          : 'Write your response here...'
                      }
                      disabled={resolved}
                      // value={formik.values.response}
                    />
                    <Button
                      className="float-right px-5 text-white bg-uzh-blue-80 disabled:opacity-60"
                      type="submit"
                      disabled={isSubmitting || resolved}
                    >
                      <Button.Icon className="mr-1">
                        <FontAwesomeIcon icon={faPaperPlane} />
                      </Button.Icon>
                      <Button.Label>Respond</Button.Label>
                    </Button>
                  </Form>
                </div>
              )}
            </Formik>
          </div>
          <div className="flex flex-col flex-initial gap-2 pl-4">
            <Button
              className="px-5"
              disabled={resolved}
              onClick={() => onPinFeedback(!pinned)}
            >
              <Button.Icon className="mr-1">
                <FontAwesomeIcon icon={faThumbTack} />
              </Button.Icon>
              <Button.Label>{pinned ? 'Unpin' : 'Pin'}</Button.Label>
            </Button>
            <Button
              className="px-5"
              icon={resolved ? 'lock open' : 'lock'}
              onClick={() => {
                onResolveFeedback(!resolved)
                if (!resolved) {
                  setIsEditingActive(false)
                }
              }}
            >
              {resolved ? (
                <Button.Icon className="mr-1">
                  <FontAwesomeIcon icon={faLockOpen} />
                </Button.Icon>
              ) : (
                <Button.Icon className="mr-1">
                  <FontAwesomeIcon icon={faLock} />
                </Button.Icon>
              )}
              {resolved ? 'Reopen' : 'Resolve'}{' '}
            </Button>
            {/* <Button
              className="px-5 text-white bg-uzh-blue-80 disabled:opacity-60"
              disabled={resolved || !formik.isValid || !formik.dirty}
              onClick={() => {
                formik.submitForm()
                setIsEditingActive(false)
              }}
            >
              <Button.Icon className="mr-1">
                <FontAwesomeIcon icon={faPaperPlane} />
              </Button.Icon>
              <Button.Label>Respond</Button.Label>
            </Button> */}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Feedback
