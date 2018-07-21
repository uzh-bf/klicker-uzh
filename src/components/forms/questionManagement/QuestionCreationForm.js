import React from 'react'
import PropTypes from 'prop-types'
import { defineMessages, FormattedMessage, intlShape } from 'react-intl'
import { Button, Form } from 'semantic-ui-react'
import { Formik } from 'formik'
import _isEmpty from 'lodash/isEmpty'
import _isNumber from 'lodash/isNumber'
import { EditorState } from 'draft-js'

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

const messages = defineMessages({
  contentEmpty: {
    defaultMessage: 'Please add a question.',
    id: 'form.createQuestion.content.empty',
  },
  minMaxRangeInvalid: {
    defaultMessage: 'Please specify a range from min to max.',
    id: 'form.createQuestion.options.minMaxRange.invalid',
  },
  optionsEmpty: {
    defaultMessage: 'Please add at least one answer option.',
    id: 'form.createQuestion.options.empty',
  },
  optionsInvalid: {
    defaultMessage: 'Invalid options',
    id: 'form.createQuestion.options.invalid',
  },
  tagsEmpty: {
    defaultMessage: 'Please add at least one tag.',
    id: 'form.createQuestion.tags.empty',
  },
  titleEmpty: {
    defaultMessage: 'Please add a title.',
    id: 'form.createQuestion.title.empty',
  },
  titleInput: {
    defaultMessage: 'Question Title',
    id: 'createQuestion.titleInput.label',
  },
  typeEmpty: {
    defaultMessage: 'Please choose a question type.',
    id: 'form.createQuestion.type.empty',
  },
})

// form validation
const validate = ({
  content, options, tags, title, type,
}) => {
  const errors = {}

  if (!title || _isEmpty(title)) {
    errors.title = messages.titleEmpty
  }

  if (!content || _isEmpty(content)) {
    errors.content = messages.contentEmpty
  }

  if (!tags || tags.length === 0) {
    errors.tags = messages.tagsEmpty
  }

  if (!type || _isEmpty(type)) {
    errors.type = messages.typeEmpty
  }

  if (
    QUESTION_GROUPS.CHOICES.includes(type)
    && (!options || options.choices.length === 0)
  ) {
    errors.options = messages.optionsEmpty
  }

  if (type === QUESTION_TYPES.FREE_RANGE) {
    if (options && options.restrictions) {
      const isMinNum = _isNumber(options.restrictions.min)
      const isMaxNum = _isNumber(options.restrictions.max)

      if (
        isMinNum
        && isMaxNum
        && options.restrictions.min >= options.restrictions.max
      ) {
        errors.options = messages.minMaxRangeInvalid
      }
    } else {
      errors.options = messages.optionsInvalid
    }
  }

  return errors
}

const propTypes = {
  intl: intlShape.isRequired,
  onDiscard: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  ),
}

const defaultProps = {
  tags: [],
}

const QuestionCreationForm = ({
  intl, tags, onSubmit, onDiscard,
}) => {
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
      <Formik
        initialValues={{
          content: EditorState.createEmpty(),
          files: [],
          options: {
            choices: [],
            randomized: false,
            restrictions: {
              max: null,
              min: null,
            },
          },
          tags: null,
          title: '',
          type: QUESTION_TYPES.SC,
        }}
        validate={validate}
        /* validationSchema={Yup.object().shape({
          content: Yup.string().required(),
          tags: Yup.array().min(1).required(),
          title: Yup.string().required(),
          type: Yup.oneOf(QUESTION_TYPES.values()).required(),
        })} */
        onSubmit={onSubmit}
      >
        {({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          handleSubmit,
          isSubmitting,
          setFieldValue,
        }) => {
          const Preview = typeComponents[values.type].preview
          const OptionsInput = typeComponents[values.type].input

          return (
            <Form onSubmit={handleSubmit}>
              <div className="questionInput questionTitle">
                <FormikInput
                  autoFocus
                  required
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
                  tooltip={(
                    <FormattedMessage
                      defaultMessage="Enter a short summarizing title for the question. This is only visible to you!"
                      id="createQuestion.titleInput.tooltip"
                    />
)}
                  touched={touched.title}
                  type="text"
                  value={values.title}
                />
              </div>

              <div className="questionInput questionType">
                <TypeChooser
                  intl={intl}
                  value={values.type}
                  onChange={newType => setFieldValue('type', newType)}
                />
              </div>

              <div className="questionInput questionTags">
                <TagInput
                  tags={tags}
                  value={values.tags}
                  onChange={newTags => setFieldValue('tags', newTags)}
                />
              </div>

              <div className="questionInput questionContent">
                <ContentInput
                  error={errors.content}
                  touched={touched.content}
                  value={values.content}
                  onChange={newContent => setFieldValue('content', newContent)}
                />
              </div>

              <div className="questionInput questionFiles">
                <h2>
                  <FormattedMessage
                    defaultMessage="Attached Files"
                    id="createQuestion.filesLabel"
                  />
                </h2>
                <FileDropzone
                  files={values.files}
                  onChangeFiles={newFiles => setFieldValue('files', newFiles)}
                />
              </div>

              <div className="questionInput questionOptions">
                <OptionsInput
                  intl={intl}
                  type={values.type}
                  value={values.options}
                  onChange={newOptions => setFieldValue('options', newOptions)}
                />
              </div>

              <div className="questionPreview">
                <h2>
                  <FormattedMessage
                    defaultMessage="Audience Preview"
                    id="createQuestion.previewLabel"
                  />
                </h2>
                <Preview
                  description={values.content.getCurrentContent()}
                  options={values.options}
                  questionType={values.type}
                  title={values.title}
                />
              </div>

              <Button className="discard" type="reset" onClick={onDiscard}>
                <FormattedMessage
                  defaultMessage="Discard"
                  id="common.button.discard"
                />
              </Button>
              <Button
                primary
                className="save"
                disabled={!_isEmpty(errors) || _isEmpty(touched)}
                loading={isSubmitting}
                type="submit"
              >
                <FormattedMessage
                  defaultMessage="Save"
                  id="common.button.save"
                />
              </Button>
            </Form>
          )
        }}
      </Formik>

      <style jsx>
        {`
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
            .questionPreview > h2 {
              font-size: 1.2rem;
              margin: 0;
              margin-bottom: 0.5rem;
            }

            @supports (grid-gap: 1rem) {
              @include desktop-tablet-only {
                display: grid;
                align-content: start;

                grid-gap: 1rem;
                grid-template-columns: repeat(6, 1fr);
                grid-template-rows: 5rem auto auto auto;
                grid-template-areas:
                  'title title title title preview preview'
                  'type type tags tags preview preview'
                  'content content content content content content'
                  'files files files files files files'
                  'options options options options options options';

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
}

QuestionCreationForm.propTypes = propTypes
QuestionCreationForm.defaultProps = defaultProps

export default QuestionCreationForm
