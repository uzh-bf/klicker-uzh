import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import isEmpty from 'validator/lib/isEmpty'
import { compose, withHandlers, withState } from 'recompose'
import { connect } from 'react-redux'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Dropdown, Form } from 'semantic-ui-react'

import { ContentInput, TagInput } from '../questions'
import { FREECreationOptions, SCCreationOptions } from '../../components/questionTypes'
import { QuestionTypes } from '../../lib'

// form validation
const validate = ({
  content, options, tags, type,
}) => {
  const errors = {}

  if (!content || isEmpty(content)) {
    errors.content = 'form.editQuestion.content.empty'
  }

  if (!tags || tags.length === 0) {
    errors.tags = 'form.editQuestion.tags.empty'
  }

  // validation of SC answer options
  if (type === QuestionTypes.SC) {
    // SC questions need at least one answer option to be valid
    if (!options || options.length === 0) {
      errors.options = 'form.editQuestion.options.empty'
    }
    // validation of FREE answer options
  } else if (type === QuestionTypes.FREE) {
    if (options && options.restrictions) {
      if (!options.restrictions.min && !options.restrictions.max) {
        errors.options = 'form.editQuestion.options.noMinMax'
      }

      if (options.restrictions.min >= options.restrictions.max) {
        errors.options = 'form.editQuestion.options.minGteMax'
      }
    }
  }

  return errors
}

const propTypes = {
  content: PropTypes.string.isRequired,
  handleNewVersionToggle: PropTypes.func.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  invalid: PropTypes.bool.isRequired,
  isNewVersion: PropTypes.bool.isRequired,
  onDiscard: PropTypes.func.isRequired,
  options: PropTypes.object,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  ),
  title: PropTypes.string.isRequired,
  type: PropTypes.string,
  versions: PropTypes.arrayOf(PropTypes.number),
}

const defaultProps = {
  options: {
    choices: [],
  },
  tags: [],
  type: QuestionTypes.SC,
  versions: [],
}

const QuestionEditForm = ({
  intl,
  isNewVersion,
  invalid,
  title,
  type,
  handleNewVersionToggle,
  handleSubmit: onSubmit,
  onDiscard,
  versions,
}) => {
  const typeComponents = {
    FREE: FREECreationOptions,
    MC: SCCreationOptions,
    SC: SCCreationOptions,
  }

  // iterate through versions to map values to dropdown preferred option set
  const versionOptions = []
  versions.forEach(({ id }, index) => versionOptions.push({ text: index + 1, value: id }))

  console.dir(versionOptions)

  return (
    <div className="questionEditForm">
      <Form onSubmit={onSubmit}>
        <div className="questionInput questionTitle">
          <Form.Field>
            <label htmlFor="title">
              <FormattedMessage defaultMessage="Title" id="teacher.editQuestion.title" />
            </label>
            <div className="title">{title}</div>
          </Form.Field>
        </div>

        <div className="questionInput questionType">
          <Form.Field>
            <label htmlFor="type">
              <FormattedMessage defaultMessage="Question Type" id="teacher.editQuestion.type" />
            </label>
            <div className="type">{type}</div>
          </Form.Field>
        </div>

        <div className="questionInput questionVersion">
          <Form.Field>
            <label htmlFor="version">
              <FormattedMessage defaultMessage="Version" id="teacher.editQuestion.version" />
            </label>
            <div className="versionDropdown">
              <Dropdown
                fluid // get last element
                selection
                defaultValue={versionOptions[versionOptions.length - 1].value}
                options={versionOptions}
                placeholder={intl.formatMessage({
                  defaultMessage: 'Select version',
                  id: 'form.questionEditForm.versionDropdown.placeholder',
                })}
              />
            </div>
            <Button onClick={handleNewVersionToggle}>New Version</Button>
          </Form.Field>
        </div>

        <div className="questionInput questionTags">
          <Field component={TagInput} disabled={!isNewVersion} name="tags" />
        </div>

        <div className="questionInput questionContent">
          <Field component={ContentInput} disabled={!isNewVersion} name="content" />
        </div>

        <div className="questionInput questionOptions">
          <Field component={typeComponents[type]} disabled={!isNewVersion} intl={intl} name="options" />
        </div>

        <div className="actionArea">
          <Link href="/questions">
            <Button className="discard" type="reset" onClick={onDiscard}>
              <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
            </Button>
          </Link>

          {isNewVersion && (
            <Button
              primary
              className="save"
              disabled={invalid}
              type="submit"
              onClick={() => console.dir(this.props.form)}
            >
              <FormattedMessage defaultMessage="Save" id="common.button.save" />
            </Button>
          )}
        </div>
      </Form>

      <style jsx>{`
        @import 'src/theme';

        .questionEditForm > :global(form) {
          display: flex;
          flex-direction: column;

          padding: 1rem;

          .questionInput,
          .questionPreview {
            margin-bottom: 1rem;
          }

          // HACK: currently one field item in question div to full-fill bigger font-size
          .questionInput > :global(.field > label) {
            font-size: 1.2rem;
          }

          .questionVersion > :global(.field),
          .actionArea {
            display: flex;
            flex-direction: column;

            :global(button) {
              flex: 1;
              margin-right: 0;
            }
          }

          @supports (grid-gap: 1rem) {
            @include desktop-tablet-only {
              display: grid;

              grid-gap: 1rem;
              grid-template-columns: 1fr 1fr;
              grid-template-rows: auto;
              grid-template-areas: 'title type' 'version tags' 'content content' 'options options' 'actions actions';

              .questionInput {
                margin-bottom: 0;
              }

              .questionTitle {
                grid-area: title;
              }

              .questionType {
                grid-area: type;
              }

              .questionVersion {
                grid-area: version;
              }

              .questionTags {
                grid-area: tags;
              }

              .questionPreview {
                grid-area: preview;
                margin-bottom: 0;
              }

              .questionContent {
                grid-area: content;
              }

              .questionOptions {
                grid-area: options;
              }

              .actionArea {
                grid-area: actions;
                flex-direction: row;
              }
            }

            @include desktop-only {
              margin: 0 20%;
              padding: 1rem 0;
            }
          }
        }
      `}</style>
    </div>
  )
}

QuestionEditForm.propTypes = propTypes
QuestionEditForm.defaultProps = defaultProps

export default compose(
  withState('isNewVersion', 'setIsNewVersion', false),
  withHandlers({
    handleNewVersionToggle: ({ setIsNewVersion }) => () => {
      setIsNewVersion(prevState => !prevState)
    },
  }),
  connect((state, props) => ({
    initialValues: {
      content: props.versions[props.versions.length - 1].description,
      options: props.versions[props.versions.length - 1].options,
      tags: props.tags,
      title: props.title,
      type: props.type,
      versions: props.versions,
    },
  })),
  reduxForm({
    enableReinitialize: true,
    form: 'editQuestion',
    validate,
  }),
)(QuestionEditForm)
