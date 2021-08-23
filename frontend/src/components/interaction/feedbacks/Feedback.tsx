import { useState } from 'react'
import dayjs from 'dayjs'
import { useMutation } from '@apollo/client'
import { Icon, Button, TextArea, Form } from 'semantic-ui-react'
import { useFormik } from 'formik'
import * as Yup from 'yup'
import PinFeedbackMutation from '../../../graphql/mutations/PinFeedbackMutation.graphql'

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
  onDelete?: any
  onPinFeedback: (pinState: boolean) => void
  onResolveFeedback: (resolvedState: boolean) => void
  onRespondToFeedback: (response: string) => void
}

const defaultProps = {
  onDelete: (f): any => f,
}

function Feedback({
  content,
  onDelete,
  createdAt,
  votes,
  resolved,
  pinned,
  responses,
  onPinFeedback,
  onResolveFeedback,
  onRespondToFeedback,
}: Props) {
  const [isEditingActive, setIsEditingActive] = useState(false)

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
      <div className="flex items-center border border-solid bg-primary-10% border-primary">
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
            <Button basic icon className="!p-2" size="tiny" onClick={() => setIsEditingActive((prev) => !prev)}>
              <Icon name={isEditingActive ? 'arrow up' : 'arrow down'} />
            </Button>
          </div>
        </div>
      </div>

      {isEditingActive && (
        <div className="p-4 border border-t-0 border-solid border-primary">
          <div className="mb-4">
            {responses.map((response) => (
              <div className="p-2 mt-2 border border-solid first:mt-0" key={response.createdAt}>
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
