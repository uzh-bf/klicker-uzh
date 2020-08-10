import React from 'react'
import getConfig from 'next/config'
import _isEmpty from 'lodash/isEmpty'
import _isNumber from 'lodash/isNumber'
import _some from 'lodash/some'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Form, Message, List, Loader } from 'semantic-ui-react'
import { useFormik } from 'formik'
import { EditorState } from 'draft-js'
import FocusLock, { AutoFocusInside } from 'react-focus-lock'

import FileDropzone from './FileDropzone'
import ContentInput from '../../questions/creation/ContentInput'
import TagInput from '../../questions/creation/TagInput'
import TypeChooser from '../../questionTypes/TypeChooser'
import SCCreationOptions from '../../questionTypes/SC/SCCreationOptions'
import SCCreationPreview from '../../questionTypes/SC/SCCreationPreview'
import FREECreationOptions from '../../questionTypes/FREE/FREECreationOptions'
import FREECreationPreview from '../../questionTypes/FREE/FREECreationPreview'
import { QUESTION_GROUPS, QUESTION_TYPES } from '../../../constants'
import FormikInput from '../components/FormikInput'

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
interface ValidationErrors {
  title?: string
  content?: string
  tags?: string
  type?: string
  options?: string
}
function validate({ content, options, tags, title, type }: any): ValidationErrors {
  const errors: any = {}

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

    if (type === QUESTION_TYPES.SC && options.choices.filter((choice): boolean => !!choice.correct).length > 1) {
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

interface Props {
  isInitialValid?: boolean
  initialValues?: {
    content: any
    files: any[]
    options: {
      choices: any[]
      randomized: boolean
      restrictions: {
        max?: number
        min?: number
      }
    }
    tags?: any[]
    title: string
    type: any
  }
  onSubmit: any
  onDiscard: () => void
  tags?: any[]
  tagsLoading: boolean
}

const defaultProps = {
  isInitialValid: false,
  tags: [],
}

function QuestionCreationForm({
  isInitialValid,
  initialValues,
  tags,
  tagsLoading,
  onSubmit,
  onDiscard,
}: Props): React.ReactElement {
  const intl = useIntl()

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

  /*
  const validationSchema = Yup.object().shape({
    content: Yup.string().required(),
    tags: Yup.array().min(1).required(),
    title: Yup.string().required(),
    type: Yup.oneOf(QUESTION_TYPES.values()).required(),
  })
  */

  const formatError = (message): React.ReactElement => {
    return <List.Item>{intl.formatMessage(message)}</List.Item>
  }

  const formik = useFormik({
    initialValues: initialValues || {
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
      tags: [],
      title: '',
      type: QUESTION_TYPES.SC,
    },
    onSubmit,
    // validationSchema
    isInitialValid,
    validate,
  })

  const Preview = typeComponents[formik.values.type].preview
  const OptionsInput = typeComponents[formik.values.type].input

  return (
    <FocusLock>
      <div className="questionCreationForm">
        <Form error={!_isEmpty(formik.errors)} onSubmit={formik.handleSubmit}>
          <div className="questionActions">
            <Button className="discard" size="large" type="button" onClick={onDiscard}>
              <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
            </Button>
            <div>
              {_some(formik.errors) && (
                <Message compact error size="small">
                  <List>
                    {formik.errors.title && formatError(formik.errors.title)}
                    {formik.errors.tags && formatError(formik.errors.tags)}
                    {formik.errors.content && formatError(formik.errors.content)}
                    {formik.errors.options && formatError(formik.errors.options)}
                  </List>
                </Message>
              )}
            </div>
            <Button
              primary
              className="save"
              disabled={!_isEmpty(formik.errors) || (!isInitialValid && _isEmpty(formik.touched))}
              loading={formik.isSubmitting}
              size="large"
              type="submit"
            >
              <FormattedMessage defaultMessage="Save" id="common.button.save" />
            </Button>
          </div>

          <div className="questionInput questionTitle">
            <AutoFocusInside>
              <FormikInput
                required
                /* error={errors.title}
              errorMessage={
                <FormattedMessage
                  defaultMessage="Please provide a valid question title (summary)."
                  id="form.questionTitle.invalid"
                />
              } */
                handleBlur={formik.handleBlur}
                handleChange={formik.handleChange}
                label={intl.formatMessage(messages.titleInput)}
                name="title"
                tooltip={
                  <FormattedMessage
                    defaultMessage="Enter a short summarizing title for the question."
                    id="createQuestion.titleInput.tooltip"
                  />
                }
                touched={formik.touched.title}
                type="text"
                value={formik.values.title}
              />
            </AutoFocusInside>
          </div>

          <div className="questionInput questionType">
            <TypeChooser
              value={formik.values.type}
              onChange={(newType): void => formik.setFieldValue('type', newType)}
            />
          </div>

          <div className="questionInput questionTags">
            {tagsLoading ? (
              <Loader active />
            ) : (
              <TagInput
                tags={tags}
                touched={formik.touched.tags}
                value={formik.values.tags}
                onChange={(newTags): void => formik.setFieldValue('tags', newTags)}
              />
            )}
          </div>

          <div className="questionInput questionContent">
            <ContentInput
              error={formik.errors.content}
              touched={formik.touched.content}
              value={formik.values.content}
              onChange={(newContent): void => formik.setFieldValue('content', newContent)}
            />
          </div>

          {publicRuntimeConfig.s3root && (
            <div className="questionInput questionFiles">
              <h2>
                <FormattedMessage defaultMessage="Attached Images" id="createQuestion.filesLabel" />
              </h2>
              <FileDropzone
                files={formik.values.files}
                onChangeFiles={(newFiles): void => formik.setFieldValue('files', newFiles)}
              />
            </div>
          )}

          <div className="questionInput questionOptions">
            <OptionsInput
              type={formik.values.type}
              value={formik.values.options}
              onChange={(newOptions): void => formik.setFieldValue('options', newOptions)}
            />
          </div>

          <div className="questionPreview">
            <h2>
              <FormattedMessage defaultMessage="Audience Preview" id="createQuestion.previewLabel" />
            </h2>
            <Preview
              description={formik.values.content.getCurrentContent()}
              options={formik.values.options}
              questionType={formik.values.type}
            />
          </div>
        </Form>
        <style jsx>{`
          @import 'src/theme';

          .questionCreationForm > :global(form) {
            display: flex;
            flex-direction: column;

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

            @supports (grid-gap: 1rem) {
              @include desktop-tablet-only {
                display: grid;
                align-content: start;

                grid-gap: 1rem;
                grid-template-columns: repeat(3, 1fr);
                grid-template-rows: auto auto auto auto;
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
                  align-items: start;

                  :global(button) {
                    margin-right: 0;
                  }

                  :global(.message) {
                    margin-right: 1rem;
                  }
                }
              }
            }
          }
        `}</style>
      </div>{' '}
    </FocusLock>
  )
}

QuestionCreationForm.defaultProps = defaultProps

export default QuestionCreationForm
