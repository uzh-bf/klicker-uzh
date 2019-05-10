import React from 'react'
import PropTypes from 'prop-types'
import getConfig from 'next/config'
import _isEmpty from 'lodash/isEmpty'
import _isNumber from 'lodash/isNumber'
import _some from 'lodash/some'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Button, Form, Message, List, Loader } from 'semantic-ui-react'
import { Formik } from 'formik'
import { EditorState, ContentState, convertFromRaw } from 'draft-js'
import { compose, withProps } from 'recompose'

import FileDropzone from './FileDropzone'
import { ContentInput, TagInput } from '../../questions'
import {
  TypeChooser,
  SCCreationOptions,
  SCCreationPreview,
  FREECreationOptions,
  FREECreationPreview,
} from '../../questionTypes'
import { QUESTION_TYPES } from '../../../lib'
import { QUESTION_GROUPS } from '../../../constants'
import { FormikInput } from '../components'

const { publicRuntimeConfig } = getConfig()

const messages = defineMessages({
  contentEmpty: {
    defaultMessage: 'Please add a question',
    id: 'form.createQuestion.content.empty',
  },
  minMaxRangeInvalid: {
    defaultMessage: 'Please specify a range from min to max',
    id: 'form.createQuestion.options.minMaxRange.invalid',
  },
  optionsEmpty: {
    defaultMessage: 'Please add at least one answer option',
    id: 'form.createQuestion.options.empty',
  },
  optionsInvalid: {
    defaultMessage: 'Invalid options',
    id: 'form.createQuestion.options.invalid',
  },
  optionsInvalidSC: {
    defaultMessage: 'SC questions may only contain a single correct option',
    id: 'form.createQuestion.options.invalidSC',
  },
  tagsEmpty: {
    defaultMessage: 'Please add at least one tag',
    id: 'form.createQuestion.tags.empty',
  },
  titleEmpty: {
    defaultMessage: 'Please add a title',
    id: 'form.createQuestion.title.empty',
  },
  titleInput: {
    defaultMessage: 'Question Title',
    id: 'createQuestion.titleInput.label',
  },
  typeEmpty: {
    defaultMessage: 'Please choose a question type',
    id: 'form.createQuestion.type.empty',
  },
})

// form validation
const validate = ({ content, options, tags, title, type }) => {
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

  if (!type || _isEmpty(type)) {
    errors.type = messages.typeEmpty
  }

  if (QUESTION_GROUPS.CHOICES.includes(type)) {
    if (!options || options.choices.length === 0) {
      errors.options = messages.optionsEmpty
    }

    if (type === QUESTION_TYPES.SC && options.choices.filter(choice => !!choice.correct).length > 1) {
      errors.options = messages.optionsInvalidSC
    }
  } else if (type === QUESTION_TYPES.FREE_RANGE) {
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
  initialValues: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    })
  ),
  tagsLoading: PropTypes.bool.isRequired,
  type: PropTypes.string,
}

const defaultProps = {
  tags: [],
  type: QUESTION_TYPES.SC,
}

const QuestionDuplicationForm = ({ initialValues, intl, tags, tagsLoading, onSubmit, onDiscard }) => {
  const typeComponents = {
    [QUESTION_TYPES.SC]: {
      input: SCCreationOptions,
      preview: SCCreationPreview,
    },
    [QUESTION_TYPES.MC]: {
      input: SCCreationOptions,
      preview: SCCreationPreview,
    },
    [QUESTION_TYPES.FREE]: {
      input: FREECreationOptions,
      preview: FREECreationPreview,
    },
    [QUESTION_TYPES.FREE_RANGE]: {
      input: FREECreationOptions,
      preview: FREECreationPreview,
    },
  }

  return (
    <div className="questionCreationForm">
      <Formik enableReinitialize initialValues={initialValues} validate={validate} onSubmit={onSubmit}>
        {({ values, errors, touched, handleChange, handleBlur, handleSubmit, isSubmitting, setFieldValue }) => {
          const Preview = typeComponents[values.type].preview
          const OptionsInput = typeComponents[values.type].input

          return (
            <Form error={!_isEmpty(errors)} onSubmit={handleSubmit}>
              <div className="questionInput questionTitle">
                <FormikInput
                  autoFocus
                  required
                  handleBlur={handleBlur}
                  handleChange={handleChange}
                  intl={intl}
                  label={intl.formatMessage(messages.titleInput)}
                  name="title"
                  tooltip={
                    <FormattedMessage
                      defaultMessage="Enter a short summarizing title for the question."
                      id="createQuestion.titleInput.tooltip"
                    />
                  }
                  touched={touched.title}
                  type="text"
                  value={values.title}
                />
              </div>

              <div className="questionInput questionType">
                <TypeChooser intl={intl} value={values.type} onChange={newType => setFieldValue('type', newType)} />
              </div>

              <div className="questionInput questionTags">
                {tagsLoading ? (
                  <Loader active />
                ) : (
                  <TagInput tags={tags} value={values.tags} onChange={newTags => setFieldValue('tags', newTags)} />
                )}
              </div>

              <div className="questionInput questionContent">
                <ContentInput
                  error={errors.content}
                  touched={touched.content}
                  value={values.content}
                  onChange={newContent => setFieldValue('content', newContent)}
                />
              </div>

              {publicRuntimeConfig.s3root && (
                <div className="questionInput questionFiles">
                  <h2>
                    <FormattedMessage defaultMessage="Attached Images (Beta)" id="createQuestion.filesLabel" />
                  </h2>
                  <FileDropzone files={values.files} onChangeFiles={newFiles => setFieldValue('files', newFiles)} />
                </div>
              )}

              <div className="questionInput questionOptions">
                <OptionsInput
                  intl={intl}
                  type={values.type}
                  value={values.options}
                  onChange={newOptions => {
                    setFieldValue('options', newOptions)
                  }}
                />
              </div>

              <div className="questionPreview">
                <h2>
                  <FormattedMessage defaultMessage="Audience Preview" id="createQuestion.previewLabel" />
                </h2>
                <Preview
                  description={values.content.getCurrentContent()}
                  options={values.options}
                  questionType={values.type}
                  title={values.title}
                />
              </div>

              <div className="questionActions">
                <Button className="discard" type="reset" onClick={onDiscard}>
                  <FormattedMessage defaultMessage="Return to Question Pool" id="createQuestion.button.backToPool" />
                </Button>

                <Button primary className="save" disabled={!_isEmpty(errors)} loading={isSubmitting} type="submit">
                  <FormattedMessage defaultMessage="Save" id="common.button.save" />
                </Button>
              </div>

              {_some(errors) && (
                <Message error>
                  <List>
                    {errors.title && <List.Item>{intl.formatMessage(errors.title)}</List.Item>}
                    {errors.tags && <List.Item>{intl.formatMessage(errors.tags)}</List.Item>}
                    {errors.content && <List.Item>{intl.formatMessage(errors.content)}</List.Item>}
                    {errors.options && <List.Item>{intl.formatMessage(errors.options)}</List.Item>}
                  </List>
                </Message>
              )}
            </Form>
          )
        }}
      </Formik>

      <style jsx>{`
        @import 'src/theme';

        .questionCreationForm > :global(form) {
          display: flex;
          flex-direction: column;

          padding: 1rem;

          .questionInput,
          .questionPreview {
            margin-bottom: 1rem;
          }

          .questionInput :global(.field > label),
          .questionPreview > h2,
          .questionFiles > h2 {
            font-size: 1.2rem !important;
            margin: 0 !important;
            margin-bottom: 0.5rem !important;
          }

          .questionActions {
            margin-top: 1rem;
          }

          @supports (grid-gap: 1rem) {
            @include desktop-tablet-only {
              display: grid;
              align-content: start;

              grid-gap: 1rem;
              grid-template-columns: repeat(3, 1fr);
              grid-template-rows: 5rem auto auto auto;
              grid-template-areas:
                'title title preview'
                'type tags preview'
                'content content content'
                'files files files'
                'options options options'
                'actions actions actions';

              .questionInput,
              .questionPreview {
                margin: 0;
              }

              .questionTitle {
                grid-area: title;
              }

              .questionType {
                grid-area: type;
              }

              .questionTags {
                grid-area: tags;
              }

              .questionPreview {
                grid-area: preview;
                align-self: stretch;
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

              .questionActions {
                grid-area: actions;
                display: flex;
                justify-content: space-between;

                :global(button) {
                  margin-right: 0;
                }
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

QuestionDuplicationForm.propTypes = propTypes
QuestionDuplicationForm.defaultProps = defaultProps

export default compose(
  withProps(({ allTags, versions, questionTags, title, type }) => {
    const duplicateTitle = '(Duplicate)'
    // When duplicating, duplicate newest version of the question
    const initializeVersion = versions.length - 1

    // Depending on original question type, populate newly created question instance
    // with missing fields.
    const prepForm = versions
    switch (type) {
      case QUESTION_TYPES.FREE:
        prepForm[initializeVersion].options = []
        prepForm[initializeVersion].options[type] = {
          choices: [],
          randomized: false,
          restrictions: {
            max: null,
            min: null,
          },
        }
        break
      case QUESTION_TYPES.FREE_RANGE:
        prepForm[initializeVersion].options[type].choices = []
        prepForm[initializeVersion].options[type].randomized = false
        break
      case QUESTION_TYPES.MC:
        prepForm[initializeVersion].options[type].randomized = false
        break
      case QUESTION_TYPES.SC:
        prepForm[initializeVersion].options[type].randomized = false
        break
      default:
        break
    }

    return {
      initialValues: {
        content: prepForm[initializeVersion].content
          ? EditorState.createWithContent(convertFromRaw(JSON.parse(prepForm[initializeVersion].content)))
          : EditorState.createWithContent(ContentState.createFromText(prepForm[initializeVersion].description)),
        files: prepForm[initializeVersion].files || [],
        options: prepForm[initializeVersion].options[type] || {},
        tags: questionTags.map(tag => tag.name),
        title: title + duplicateTitle,
        type,
        versions: prepForm,
      },
      tags: allTags,
    }
  })
)(QuestionDuplicationForm)
