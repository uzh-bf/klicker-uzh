import React from 'react'
import PropTypes from 'prop-types'
import _isEmpty from 'lodash/isEmpty'
import _isNumber from 'lodash/isNumber'
import getConfig from 'next/config'
import { compose, withProps } from 'recompose'
import { EditorState, ContentState, convertFromRaw } from 'draft-js'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Button, Form, Dropdown, Message } from 'semantic-ui-react'
import { Formik } from 'formik'

import FileDropzone from './FileDropzone'
import { FormikInput } from '../components'
import { generateTypesLabel } from '../../../lib'
import { ContentInput, TagInput } from '../../questions'
import { FREECreationOptions, SCCreationOptions } from '../../questionTypes'
import { QUESTION_TYPES, QUESTION_GROUPS } from '../../../constants'

const { publicRuntimeConfig } = getConfig()

const messages = defineMessages({
  contentEmpty: {
    defaultMessage: 'Please add a question.',
    id: 'form.editQuestion.content.empty',
  },
  minMaxRangeInvalid: {
    defaultMessage: 'Please specify a range from min to max.',
    id: 'form.editQuestion.options.minMaxRange.invalid',
  },
  optionsEmpty: {
    defaultMessage: 'Please add at least one answer option.',
    id: 'form.editQuestion.options.empty',
  },
  optionsInvalid: {
    defaultMessage: 'Invalid options',
    id: 'form.editQuestion.options.invalid',
  },
  tagsEmpty: {
    defaultMessage: 'Please add at least one tag.',
    id: 'form.editQuestion.tags.empty',
  },
  titleEmpty: {
    defaultMessage: 'Please add a question title.',
    id: 'form.editQuestion.title.empty',
  },
  titleInput: {
    defaultMessage: 'Question Title',
    id: 'editQuestion.titleInput.label',
  },
})

// form validation
const validate = ({ title, content, options, tags, type }) => {
  const errors = {}

  if (!title || _isEmpty(title)) {
    errors.title = messages.titleEmpty
  }

  if (!content.getCurrentContent().hasText()) {
    errors.content = messages.contentEmpty
  }

  if (!tags || tags.length === 0) {
    errors.tags = messages.tagsEmpty
  }

  if (QUESTION_GROUPS.CHOICES.includes(type) && (!options || options.choices.length === 0)) {
    errors.options = messages.optionsEmpty
  }

  if (type === QUESTION_TYPES.FREE_RANGE) {
    if (options && options.restrictions) {
      const isMinNum = _isNumber(options.restrictions.min)
      const isMaxNum = _isNumber(options.restrictions.max)

      if (isMinNum && isMaxNum && options.restrictions.min >= options.restrictions.max) {
        errors.options = messages.minMaxRangeInvalid
      }
    } else {
      errors.options = messages.optionsInvalid
    }
  }

  return errors
}

const propTypes = {
  activeVersion: PropTypes.number.isRequired,
  editSuccess: PropTypes.object.isRequired,
  initialValues: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
  isNewVersion: PropTypes.bool.isRequired,
  loading: PropTypes.bool.isRequired,
  onActiveVersionChange: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    })
  ),
  type: PropTypes.string,
  versionOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
}

const defaultProps = {
  tags: [],
  type: QUESTION_TYPES.SC,
}

const typeComponents = {
  FREE: FREECreationOptions,
  FREE_RANGE: FREECreationOptions,
  MC: SCCreationOptions,
  SC: SCCreationOptions,
}

const QuestionEditForm = ({
  activeVersion,
  editSuccess,
  initialValues,
  intl,
  isNewVersion,
  loading,
  tags,
  type,
  onSubmit,
  onActiveVersionChange,
  onDiscard,
  versionOptions,
}) => (
  <div className="questionEditForm">
    <Formik
      enableReinitialize
      initialValues={initialValues}
      validate={validate}
      // validationSchema={Yup.object().shape({})}
      onSubmit={onSubmit}
    >
      {({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        setFieldValue,
        setFieldTouched,
        isSubmitting,
      }) => {
        const OptionsInput = typeComponents[type]
        const { message, success } = editSuccess

        return (
          <Form error={success === false} success={success === true} onSubmit={handleSubmit}>
            <div className="infoMessage">
              <Message success>
                <FormattedMessage defaultMessage="Successfully modified question." id="editQuestion.sucess" />
              </Message>
              <Message error>
                <FormattedMessage
                  defaultMessage="Could not modify question: {error}"
                  id="editQuestion.error"
                  values={{ error: message }}
                />
              </Message>
            </div>
            <div className="questionInput questionType">
              <Form.Field>
                <label htmlFor="type">
                  <FormattedMessage defaultMessage="Question Type" id="editQuestion.type" />
                </label>
                <div className="type">{generateTypesLabel(intl)[type]}</div>
              </Form.Field>
            </div>

            <div className="questionInput questionTitle">
              <FormikInput
                /* error={errors.title}
                errorMessage={
                  <FormattedMessage
                    defaultMessage="Please provide a valid question title (summary)."
                    id="form.questionTitle.invalid"
                  />
                } */
                handleBlur={handleBlur}
                handleChange={handleChange}
                intl={intl}
                label={intl.formatMessage(messages.titleInput)}
                name="title"
                tooltip={
                  <FormattedMessage
                    defaultMessage="Enter a short summarizing title for the question. This is only visible to you!"
                    id="createQuestion.titleInput.tooltip"
                  />
                }
                touched={touched.title}
                type="text"
                value={values.title}
              />
            </div>

            <div className="questionVersion">
              <h2>
                <FormattedMessage defaultMessage="Question Contents" id="editQuestion.questionContents.title" />
              </h2>

              <Dropdown
                text={isNewVersion ? `v${versionOptions.length + 1} (draft)` : `v${activeVersion + 1}`}
                value={activeVersion}
              >
                <Dropdown.Menu>
                  <Dropdown.Item active={isNewVersion} onClick={() => onActiveVersionChange(versionOptions.length)}>
                    {`v${versionOptions.length + 1} (draft)`}
                  </Dropdown.Item>

                  {versionOptions
                    .map(({ id, text }, index) => (
                      <Dropdown.Item
                        active={activeVersion === index}
                        key={id}
                        onClick={() => onActiveVersionChange(index)}
                      >
                        {text}
                      </Dropdown.Item>
                    ))
                    .reverse()}
                </Dropdown.Menu>
              </Dropdown>
            </div>

            <div className="questionInput questionTags">
              <TagInput
                tags={tags}
                value={values.tags}
                onChange={newTags => {
                  setFieldTouched('tags', true, false)
                  setFieldValue('tags', newTags)
                }}
              />
            </div>

            <div className="questionInput questionContent">
              <ContentInput
                disabled={!isNewVersion}
                error={errors.content}
                touched={touched.content}
                value={values.content}
                onChange={newContent => {
                  setFieldTouched('content', true, false)
                  setFieldValue('content', newContent)
                }}
              />
            </div>

            {publicRuntimeConfig.s3root && (
              <div className="questionInput questionFiles">
                <h3>
                  <FormattedMessage defaultMessage="Attached Files (Beta)" id="createQuestion.filesLabel" />
                </h3>
                <FileDropzone
                  disabled={!isNewVersion}
                  files={values.files}
                  onChangeFiles={newFiles => setFieldValue('files', newFiles)}
                />
              </div>
            )}

            <div className="questionInput questionOptions">
              <OptionsInput
                disabled={!isNewVersion}
                intl={intl}
                type={values.type}
                value={values.options}
                onChange={newOptions => {
                  setFieldTouched('options', true, false)
                  setFieldValue('options', newOptions)
                }}
              />
            </div>

            <div className="actionArea">
              <Button className="discard" type="reset" onClick={onDiscard}>
                <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
              </Button>
              <Button
                primary
                className="save"
                disabled={!_isEmpty(errors) || _isEmpty(touched)}
                loading={loading && isSubmitting}
                type="submit"
              >
                <FormattedMessage defaultMessage="Save" id="common.button.save" />
              </Button>
            </div>
          </Form>
        )
      }}
    </Formik>

    <style jsx>
      {`
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

          .questionVersion {
            display: flex;
            align-items: center;

            h2 {
              margin: 0;
            }

            :global(.dropdown) {
              margin-left: 0.5rem;
            }
          }

          .questionVersion > :global(.field),
          .actionArea {
            display: flex;
            flex-direction: column;

            :global(button) {
              margin-right: 0;
            }
          }

          @supports (grid-gap: 1rem) {
            @include desktop-tablet-only {
              display: grid;

              grid-gap: 1rem;
              grid-template-columns: 1fr 4fr;
              grid-template-rows: auto;
              grid-template-areas:
                'message message'
                'type title'
                'tags tags'
                'version version'
                'content content'
                'files files'
                'options options'
                'actions actions';

              .questionInput {
                margin-bottom: 0;
              }

              .infoMessage {
                grid-area: message;

                > :global(.message) {
                  margin-bottom: 0;
                }
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

              .questionFiles {
                grid-area: files;
              }

              .questionOptions {
                grid-area: options;
              }

              .actionArea {
                grid-area: actions;
                flex-direction: row;

                justify-content: space-between;
              }
            }

            @include desktop-only {
              margin: 0 20%;
              padding: 1rem 0;
            }
          }
        }
      `}
    </style>
  </div>
)

QuestionEditForm.propTypes = propTypes
QuestionEditForm.defaultProps = defaultProps

export default compose(
  withProps(({ allTags, activeVersion, versions, questionTags, title, type, onSubmit }) => {
    // if the active version would be out of array bounds, we are creating a new one
    const isNewVersion = activeVersion === versions.length

    // calculate the version with which to initialize the version fields (the current or last one)
    const initializeVersion = isNewVersion ? versions.length - 1 : activeVersion

    return {
      initialValues: {
        content: versions[initializeVersion].content
          ? EditorState.createWithContent(convertFromRaw(JSON.parse(versions[initializeVersion].content)))
          : EditorState.createWithContent(ContentState.createFromText(versions[initializeVersion].description)),
        files: versions[initializeVersion].files || [],
        options: versions[initializeVersion].options[type] || {},
        tags: questionTags.map(tag => tag.name),
        title,
        type,
        versions,
      },
      isNewVersion,
      onSubmit: onSubmit(isNewVersion),
      tags: allTags,
      versionOptions: versions.map(({ id }, index) => ({
        text: `v${index + 1}`,
        value: id,
      })),
    }
  })
)(QuestionEditForm)
