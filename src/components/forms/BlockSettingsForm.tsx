import React, { useState } from 'react'
import _isEmpty from 'lodash/isEmpty'
import { useIntl } from 'react-intl'
import { useMutation } from '@apollo/react-hooks'
import { Dropdown, Form, Button, Modal } from 'semantic-ui-react'
import { Formik } from 'formik'
import { object, number } from 'yup'
import FormikInput from './components/FormikInput'
import ModifyQuestionBlockMutation from '../../graphql/mutations/ModifyQuestionBlockMutation.graphql'

interface Props {
  sessionId: string
  questionBlockId: string
  initialTimeLimit?: number
}

const defaultProps = {
  initialTimeLimit: -1,
}

function BlockSettingsForm({ sessionId, questionBlockId, initialTimeLimit }: Props): React.ReactElement {
  // const intl = useIntl()

  const [isModalVisible, setIsModalVisible] = useState(false)

  const [modifyQuestionBlock] = useMutation(ModifyQuestionBlockMutation)

  const onModalOpen = (): void => setIsModalVisible(true)
  const onModalClose = (): void => setIsModalVisible(false)
  const onResetTimeLimit = ({ setFieldValue, setSubmitting }): any => async (): Promise<void> => {
    setSubmitting(true)
    await modifyQuestionBlock({ variables: { sessionId, id: questionBlockId, timeLimit: -1 } })
    setFieldValue('timeLimit', -1)
    setSubmitting(false)
  }

  return (
    <Formik
      initialValues={{
        timeLimit: initialTimeLimit,
      }}
      render={({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
        setSubmitting,
        setFieldValue,
      }): React.ReactElement => (
        <Modal
          open={isModalVisible}
          trigger={<Dropdown.Item icon="settings" text="Block settings" onClick={onModalOpen} />}
        >
          <Modal.Header>Block Settings</Modal.Header>
          <Modal.Content>
            <Form loading={isSubmitting}>
              <FormikInput
                autoFocus
                required
                action={<Button icon="times" onClick={onResetTimeLimit({ setFieldValue, setSubmitting })} />}
                actionPosition="left"
                error={errors.timeLimit}
                // errorMessage={intl.formatMessage(messages.emailInvalid)}
                handleBlur={handleBlur}
                handleChange={handleChange}
                inlineLabel="sec"
                label="Time limit"
                labelPosition="right"
                max={3600}
                min={-1}
                name="timeLimit"
                touched={touched.timeLimit}
                type="number"
                value={values.timeLimit}
              />
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button content="Discard" icon="times" type="button" onClick={onModalClose} />
            <Button
              primary
              content="Save"
              disabled={isSubmitting || !_isEmpty(errors)}
              icon="save"
              type="submit"
              onClick={(): any => handleSubmit()}
            />
          </Modal.Actions>
        </Modal>
      )}
      validationSchema={object()
        .shape({
          timeLimit: number()
            .min(-1)
            .max(3600)
            .required(),
        })
        .required()}
      onSubmit={async ({ timeLimit }, { setSubmitting }): Promise<void> => {
        await modifyQuestionBlock({ variables: { sessionId, id: questionBlockId, timeLimit } })
        setSubmitting(false)
        onModalClose()
      }}
    />
  )
}

BlockSettingsForm.defaultProps = defaultProps

export default BlockSettingsForm
