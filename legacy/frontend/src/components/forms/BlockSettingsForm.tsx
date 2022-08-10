import { useMutation } from '@apollo/client'
import { faFloppyDisk } from '@fortawesome/free-regular-svg-icons'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { Formik } from 'formik'
import _isEmpty from 'lodash/isEmpty'
import React, { useState } from 'react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Checkbox, Dropdown, Form, Modal } from 'semantic-ui-react'
import { boolean, number, object } from 'yup'

import ModifyQuestionBlockMutation from '../../graphql/mutations/ModifyQuestionBlockMutation.graphql'
import FormikInput from './components/FormikInput'

interface Props {
  disabled?: boolean
  sessionId: string
  questionBlockId: string
  initialTimeLimit?: number
  initialRandomSelection?: number
  withQuestionBlockExperiments?: boolean
}

const defaultProps = {
  disabled: false,
  initialTimeLimit: -1,
  initialRandomSelection: -1,
  withQuestionBlockExperiments: false,
}

const messages = defineMessages({
  timeLimit: {
    id: 'form.blockSettings.timeLimit',
    defaultMessage: 'Time limit',
  },
  blockSettings: {
    id: 'form.blockSettings.header',
    defaultMessage: 'Control block execution',
  },
})

function BlockSettingsForm({
  disabled,
  sessionId,
  questionBlockId,
  initialTimeLimit,
  initialRandomSelection,
  withQuestionBlockExperiments,
}: Props): React.ReactElement {
  const intl = useIntl()

  const [isModalVisible, setIsModalVisible] = useState(false)

  const [modifyQuestionBlock] = useMutation(ModifyQuestionBlockMutation)

  const onModalOpen = (): void => setIsModalVisible(true)
  const onModalClose = (): void => setIsModalVisible(false)
  const onResetTimeLimit =
    ({ setFieldValue, setSubmitting }): any =>
    async (): Promise<void> => {
      setSubmitting(true)
      await modifyQuestionBlock({ variables: { sessionId, id: questionBlockId, timeLimit: -1 } })
      setFieldValue('timeLimit', -1)
      setSubmitting(false)
    }

  return (
    <Formik
      initialValues={{
        timeLimit: initialTimeLimit,
        randomSelection: initialRandomSelection > 0,
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
          trigger={
            <Dropdown.Item
              disabled={disabled}
              icon="options"
              text={intl.formatMessage(messages.blockSettings)}
              onClick={onModalOpen}
            />
          }
        >
          <Modal.Header>{intl.formatMessage(messages.blockSettings)}</Modal.Header>
          <Modal.Content>
            <Form loading={isSubmitting}>
              <FormikInput
                required
                action={
                  <Button onClick={onResetTimeLimit({ setFieldValue, setSubmitting })}>
                    <Button.Icon>
                      <FontAwesomeIcon icon={faXmark} size="lg" />
                    </Button.Icon>
                  </Button>
                }
                actionPosition="left"
                error={errors.timeLimit}
                // errorMessage={intl.formatMessage(messages.emailInvalid)}
                handleBlur={handleBlur}
                handleChange={handleChange}
                inlineLabel="sec"
                label={intl.formatMessage(messages.timeLimit)}
                labelPosition="right"
                max={3600}
                min={-1}
                name="timeLimit"
                touched={touched.timeLimit}
                type="number"
                value={values.timeLimit}
              />
              {withQuestionBlockExperiments && (
                <Form.Field>
                  <label htmlFor="randomSelection">
                    <FormattedMessage defaultMessage="Random selection" id="form.blockSettings.randomSelection.label" />
                  </label>
                  <div className="mb-4 prose-sm prose border rounded max-w-none">
                    <FormattedMessage
                      defaultMessage="If random selection is activated, each student will receive only one of the questions within the block selected at random."
                      id="form.blockSettings.randomSelection.description"
                    />
                  </div>
                  <Checkbox
                    toggle
                    checked={values.randomSelection}
                    id="randomSelection"
                    name="randomSelection"
                    touched={touched.randomSelection}
                    onChange={handleChange}
                  />
                </Form.Field>
              )}
            </Form>
          </Modal.Content>
          <Modal.Actions>
            <Button className="p-2 px-3 mr-1" onClick={onModalClose}>
              <Button.Icon>
                <FontAwesomeIcon icon={faXmark} size="lg" />
              </Button.Icon>
              <Button.Label>
                <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
              </Button.Label>
            </Button>
            <Button
              className="p-2 px-3"
              disabled={isSubmitting || !_isEmpty(errors)}
              type="submit"
              onClick={(): any => handleSubmit()}
            >
              <Button.Icon>
                <FontAwesomeIcon icon={faFloppyDisk} size="lg" />
              </Button.Icon>
              <Button.Label>
                <FormattedMessage defaultMessage="Save" id="common.button.save" />
              </Button.Label>
            </Button>
          </Modal.Actions>
        </Modal>
      )}
      validationSchema={object()
        .shape({
          timeLimit: number().min(-1).max(3600).required(),
          randomSelection: boolean(),
        })
        .required()}
      onSubmit={async ({ timeLimit, randomSelection }, { setSubmitting }): Promise<void> => {
        await modifyQuestionBlock({
          variables: { sessionId, id: questionBlockId, timeLimit, randomSelection: randomSelection ? 1 : -1 },
        })
        setSubmitting(false)
        onModalClose()
      }}
    />
  )
}

BlockSettingsForm.defaultProps = defaultProps

export default BlockSettingsForm
