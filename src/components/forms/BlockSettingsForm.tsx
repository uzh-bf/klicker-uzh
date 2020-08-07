import React, { useState } from 'react'
import _isEmpty from 'lodash/isEmpty'
import { useIntl, FormattedMessage, defineMessages } from 'react-intl'
import { useMutation } from '@apollo/react-hooks'
import { Dropdown, Form, Button, Modal } from 'semantic-ui-react'
import { useFormik } from 'formik'
import { object, number } from 'yup'
import FormikInput from './components/FormikInput'
import ModifyQuestionBlockMutation from '../../graphql/mutations/ModifyQuestionBlockMutation.graphql'

interface Props {
  disabled?: boolean
  sessionId: string
  questionBlockId: string
  initialTimeLimit?: number
}

const defaultProps = {
  disabled: false,
  initialTimeLimit: -1,
}

const messages = defineMessages({
  timeLimit: {
    id: 'form.blockSettings.timeLimit',
    defaultMessage: 'Time limit',
  },
  blockSettings: {
    id: 'form.blockSettings.header',
    defaultMessage: 'Set time limit',
  },
})

function BlockSettingsForm({ disabled, sessionId, questionBlockId, initialTimeLimit }: Props): React.ReactElement {
  const intl = useIntl()

  const [isModalVisible, setIsModalVisible] = useState(false)

  const [modifyQuestionBlock] = useMutation(ModifyQuestionBlockMutation)

  const onModalOpen = (): void => setIsModalVisible(true)
  const onModalClose = (): void => setIsModalVisible(false)
  const onResetTimeLimit = (formik): any => async (): Promise<void> => {
    formik.setSubmitting(true)
    await modifyQuestionBlock({ variables: { sessionId, id: questionBlockId, timeLimit: -1 } })
    formik.setFieldValue('timeLimit', -1)
    formik.setSubmitting(false)
  }

  const requiredValidationSchema = object()
    .shape({
      timeLimit: number().min(-1).max(3600).required(),
    })
    .required()

  const onSubmit = async ({ timeLimit }, { setSubmitting }): Promise<void> => {
    await modifyQuestionBlock({ variables: { sessionId, id: questionBlockId, timeLimit } })
    setSubmitting(false)
    onModalClose()
  }

  const formik = useFormik({
    initialValues: {
      timeLimit: initialTimeLimit,
    },
    onSubmit,
    validationSchema: requiredValidationSchema,
  })

  return (
    <Modal
      open={isModalVisible}
      trigger={
        <Dropdown.Item
          disabled={disabled}
          icon="time"
          text={intl.formatMessage(messages.blockSettings)}
          onClick={onModalOpen}
        />
      }
    >
      <Modal.Header>{intl.formatMessage(messages.blockSettings)}</Modal.Header>
      <Modal.Content>
        <Form loading={formik.isSubmitting}>
          <FormikInput
            autoFocus
            required
            action={<Button icon="times" onClick={onResetTimeLimit(formik)} />}
            actionPosition="left"
            error={formik.errors.timeLimit}
            // errorMessage={intl.formatMessage(messages.emailInvalid)}
            handleBlur={formik.handleBlur}
            handleChange={formik.handleChange}
            inlineLabel="sec"
            label={intl.formatMessage(messages.timeLimit)}
            labelPosition="right"
            max={3600}
            min={-1}
            name="timeLimit"
            touched={formik.touched.timeLimit}
            type="number"
            value={formik.values.timeLimit}
          />
        </Form>
      </Modal.Content>
      <Modal.Actions>
        <Button icon="times" type="button" onClick={onModalClose}>
          <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
        </Button>
        <Button
          primary
          disabled={formik.isSubmitting || !_isEmpty(formik.errors)}
          icon="save"
          type="submit"
          onClick={(): any => formik.handleSubmit()}
        >
          <FormattedMessage defaultMessage="Save" id="common.button.save" />
        </Button>
      </Modal.Actions>
    </Modal>
  )
}

BlockSettingsForm.defaultProps = defaultProps

export default BlockSettingsForm
