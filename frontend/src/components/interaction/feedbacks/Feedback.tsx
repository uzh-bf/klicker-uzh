import { useState } from 'react'
import dayjs from 'dayjs'
import { Icon, Button, TextArea, Form } from 'semantic-ui-react'
import { useFormik } from 'formik'
import * as Yup from 'yup'

interface IFeedbackResponse {
  id: string
  content: string
  createdAt: string
}

interface IFeedback {
  content: string
  createdAt: string
  votes: number
  resolved: boolean
  pinned: boolean
  responses: IFeedbackResponse[]
}

interface Props extends IFeedback {
  onDeleteFeedback: () => void
  onPinFeedback: (pinState: boolean) => void
  onResolveFeedback: (resolvedState: boolean) => void
  onRespondToFeedback: (response: string) => void
  onDeleteResponse: (responseId: string) => void
}

const defaultProps = {
  onDelete: (f): any => f,
}

function Feedback({
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
      onRespondToFeedback(values.response)
      resetForm()
    },
  })

  return (
    <div>
      <div className="flex items-center border border-solid bg-primary-10% border-primary rounded shadow">
        <div className="flex-1 p-4">
          <p className="mb-0">{content}</p>
          <div className="flex flex-row mt-2 text-gray-500">
            <div>{dayjs(createdAt).format('DD.MM.YYYY HH:mm')}</div>
            <div className="ml-8">{resolved ? 'RESOLVED' : 'OPEN'}</div>
            <div className="ml-8">{pinned && <Icon name="pin" />}</div>
          </div>
        </div>
        <div className="flex flex-col items-end justify-between flex-initial p-2">
          <div className="text-xl text-gray-500">
            {votes} <Icon name="thumbs up outline" />
          </div>
          <div className="mt-2">
            <Button
              basic={!isBeingDeleted}
              className="!p-2 !mr-2"
              color={isBeingDeleted ? 'red' : undefined}
              icon="trash"
              size="tiny"
              onClick={() => {
                if (isBeingDeleted) {
                  onDeleteFeedback()
                } else {
                  setIsBeingDeleted(true)
                }
              }}
            />
            <Button
              basic
              className="!p-2"
              icon={isEditingActive ? 'arrow up' : 'arrow down'}
              size="tiny"
              onClick={() => setIsEditingActive((prev) => !prev)}
            />
          </div>
        </div>
      </div>

      {isEditingActive && (
        <div className="p-4 border border-t-0 border-solid border-primary">
          <div>
            {responses.map((response) => (
              <div
                className="relative p-2 mt-2 border border-solid rounded first:mt-0 last:mb-4"
                key={response.createdAt}
              >
                <div>
                  <Button
                    basic
                    className="absolute top-2 right-2 !mr-0 !p-2"
                    icon="trash"
                    size="tiny"
                    onClick={() => onDeleteResponse(response.id)}
                  />
                </div>
                <p className="mb-0">{response.content}</p>
                <div className="mt-2 text-gray-500">{dayjs(response.createdAt).format('DD.MM.YYYY HH:mm')}</div>
              </div>
            ))}
          </div>
          <div className="flex">
            <div className="flex-1">
              <Form className="h-full">
                <TextArea
                  className="h-full"
                  id="response"
                  placeholder="Write your response here..."
                  rows={3}
                  value={formik.values.response}
                  onChange={formik.handleChange}
                />
              </Form>
            </div>
            <div className="flex flex-col flex-initial pl-4">
              <Button
                compact
                className="!mr-0"
                content={pinned ? 'Unpin' : 'Pin'}
                disabled={resolved}
                icon="pin"
                labelPosition="left"
                onClick={() => onPinFeedback(!pinned)}
              />
              <Button
                compact
                className="!mt-2 !mr-0"
                content={resolved ? 'Reopen' : 'Resolve'}
                icon={resolved ? 'lock open' : 'lock'}
                labelPosition="left"
                onClick={() => {
                  onResolveFeedback(!resolved)
                  if (!resolved) {
                    setIsEditingActive(false)
                  }
                }}
              />
              <Button
                compact
                primary
                className="!mt-2 !mr-0"
                content="Respond"
                disabled={resolved || !formik.isValid || !formik.dirty}
                icon="send"
                labelPosition="left"
                onClick={() => formik.submitForm()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

Feedback.defaultProps = defaultProps

export default Feedback
