import React from 'react'
import PropTypes from 'prop-types'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Button, Icon } from 'semantic-ui-react'
import moment from 'moment'
import { Formik } from 'formik'
import Yup from 'yup'
import _isEmpty from 'lodash/isEmpty'

import { FormikInput } from '.'
import { SessionTimelineInput } from '../sessions'

const messages = defineMessages({
  sessionNameInvalid: {
    defaultMessage: 'Please provide a valid name for your session.',
    id: 'form.sessionName.invalid',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired,
}

const SessionCreationForm = ({
  intl, onSave, onDiscard, onStart,
}) => (
  <Formik
    initialValues={{
      blocks: [],
      // initialize session name to the current date and time
      sessionName: moment().format('DD.MM.YYYY HH:mm'),
    }}
    validationSchema={Yup.object().shape({
      blocks: Yup.array()
        .min(1)
        .required(),
      sessionName: Yup.string().required(),
    })}
    onSubmit={({ start, ...values }) => {
      // if it should be immediately started
      if (start) {
        onStart(values)
      }

      // if the session should only be saved
      onSave(values)
    }}
  >
    {({
      values,
      errors,
      touched,
      handleChange,
      handleBlur,
      handleSubmit,
      submitForm,
      isSubmitting,
      setFieldValue,
    }) => (
      <form className="ui form sessionCreation" onSubmit={handleSubmit}>
        <div className="upper">
          <h2 className="title">
            <FormattedMessage defaultMessage="Create Session" id="sessionCreation.title" />
          </h2>

          <div className="sessionSettings">
            <div className="sessionName">
              <FormikInput
                autoFocus
                required
                error={errors.sessionName}
                errorMessage={intl.formatMessage(messages.sessionNameInvalid)}
                handleBlur={handleBlur}
                handleChange={handleChange}
                inlineLabel="Name"
                labelPosition="left"
                name="sessionName"
                placeholder="Session #1"
                touched={touched.sessionName}
                type="text"
                value={values.sessionName}
              />
            </div>
          </div>
        </div>

        <div className="sessionTimeline">
          <SessionTimelineInput
            value={values.blocks}
            onChange={blocks => setFieldValue('blocks', blocks)}
          />
        </div>

        <div className="actionArea">
          <Button fluid icon labelPosition="left" onClick={onDiscard}>
            <Icon name="trash" />
            <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
          </Button>

          <Button
            fluid
            icon
            disabled={!_isEmpty(errors)}
            labelPosition="left"
            loading={isSubmitting}
            type="submit"
          >
            <Icon name="save" />
            <FormattedMessage defaultMessage="Save & Close" id="form.createSession.button.save" />
          </Button>

          <Button
            fluid
            icon
            primary
            disabled={!_isEmpty(errors)}
            labelPosition="left"
            loading={isSubmitting}
            onClick={() => {
              setFieldValue('start', true)
              submitForm()
            }}
          >
            <Icon name="play" />
            <FormattedMessage defaultMessage="Start" id="common.button.start" />
          </Button>
        </div>

        <style jsx>{`
          @import 'src/theme';

          .sessionCreation {
            display: flex;
            flex-flow: row wrap;

            background-color: white;

            .title {
              font-size: 1.5rem;
              margin: 0;

              padding: 0.5rem 1rem;
            }

            .upper {
              flex: 0 0 100%;

              border-bottom: 1px solid lightgrey;
              border-top: 1px solid lightgrey;
              text-align: center;
              padding: 0 1rem 1rem 1rem;
            }

            .sessionTimeline {
              flex: 1;
            }

            .actionArea {
              flex: 0 0 auto;

              border: 1px solid lightgrey;
              border-top: 0;
              padding: 0.5rem;

              > :global(button) {
                :global(span) {
                  margin-left: 2rem;
                }

                &:not(:last-child) {
                  margin-bottom: 0.5rem;
                }

                &:first-child {
                  margin-bottom: 2rem;
                }
              }
            }
          }
        `}</style>
      </form>
    )}
  </Formik>
)

SessionCreationForm.propTypes = propTypes

export default SessionCreationForm
