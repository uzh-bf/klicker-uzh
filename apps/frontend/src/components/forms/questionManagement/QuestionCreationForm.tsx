import React from 'react'
import getConfig from 'next/config'
import _isEmpty from 'lodash/isEmpty'
import _isNumber from 'lodash/isNumber'
import _some from 'lodash/some'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Form, Message, List, Loader, Icon } from 'semantic-ui-react'
import { Field, Formik } from 'formik'
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
import CustomTooltip from '../../common/CustomTooltip'

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

  if (content.length === 1 && content[0].children[0].text === '') {
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
  initialValues: undefined,
}

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

function QuestionCreationForm({
  isInitialValid,
  initialValues,
  tags,
  tagsLoading,
  onSubmit,
  onDiscard,
}: Props): React.ReactElement {
  const intl = useIntl()

  const initialValue = [
    {
      type: 'paragraph',
      children: [{ text: '' }],
    },
  ]

  return (
    <div className="flex flex-col questionCreationForm">
      <Formik
        initialValues={
          initialValues || {
            content: initialValue,
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
          }
        }
        isInitialValid={isInitialValid}
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
        }: any): React.ReactElement => {
          const Preview = typeComponents[values.type].preview
          const OptionsInput = typeComponents[values.type].input

          return (
            <FocusLock>
              <Form error={!_isEmpty(errors)} onSubmit={handleSubmit}>
                <div className="questionActions">
                  <Button className="discard" size="large" type="button" onClick={onDiscard}>
                    <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
                  </Button>
                  <div>
                    {_some(errors) && (
                      <Message compact error size="small">
                        <List>
                          {errors.title && <List.Item>{intl.formatMessage(errors.title)}</List.Item>}
                          {errors.tags && <List.Item>{intl.formatMessage(errors.tags)}</List.Item>}
                          {errors.content && <List.Item>{intl.formatMessage(errors.content)}</List.Item>}
                          {errors.options && <List.Item>{intl.formatMessage(errors.options)}</List.Item>}
                        </List>
                      </Message>
                    )}
                  </div>
                  <Button
                    primary
                    className="save"
                    disabled={!_isEmpty(errors) || (!isInitialValid && _isEmpty(touched))}
                    loading={isSubmitting}
                    size="large"
                    type="submit"
                  >
                    <FormattedMessage defaultMessage="Save" id="common.button.save" />
                  </Button>
                </div>

                <div className="mb-4 questionInput questionTitle">
                  <AutoFocusInside>
                    <label className="flex-1 text-xl !mb-2 font-bold" htmlFor="content">
                      <span className="mb-10">{intl.formatMessage(messages.titleInput)}</span>

                      <CustomTooltip
                        tooltip={
                          <FormattedMessage
                            defaultMessage="Enter a short summarizing title for the question."
                            id="createQuestion.titleInput.tooltip"
                          />
                        }
                        tooltipStyle={'text-sm md:text-base max-w-[25%] md:max-w-[40%]'}
                        withArrow={false}
                      >
                        <Icon className="!ml-2" color="blue" name="question circle" />
                        <span className="text-red-600">*</span>
                      </CustomTooltip>
                    </label>

                    <Field
                      className="!mt-2"
                      handleBlur={handleBlur}
                      handleChange={handleChange}
                      label={intl.formatMessage(messages.titleInput)}
                      name="title"
                      touched={touched.title}
                      type="text"
                      value={values.title}
                    />
                  </AutoFocusInside>
                </div>

                <div className="text-xl !mb-2 questionInput questionType">
                  <TypeChooser value={values.type} onChange={(newType): void => setFieldValue('type', newType)} />
                </div>

                <div className="text-xl !mb-2 questionInput questionTags">
                  {tagsLoading ? (
                    <Loader active />
                  ) : (
                    <TagInput
                      tags={tags}
                      touched={touched.tags}
                      value={values.tags}
                      onChange={(newTags): void => setFieldValue('tags', newTags)}
                    />
                  )}
                </div>

                <div className="mb-4 questionInput questionContent">
                  <label className="flex-1 text-xl !mb-2 font-bold" htmlFor="content">
                    <FormattedMessage defaultMessage="Question" id="createQuestion.contentInput.label" />

                    <CustomTooltip
                      tooltip={
                        <FormattedMessage
                          defaultMessage="Enter the question you want to ask the audience. The rich text editor supports the following (block) styles: bold text, italic text, code, quotes, numbered lists, unnumbered lists and LaTeX formulas. Hover over the buttons for more detailed information."
                          id="createQuestion.contentInput.tooltip"
                        />
                      }
                      tooltipStyle={'text-sm md:text-base max-w-[25%] md:max-w-[40%]'}
                      withArrow={false}
                    >
                      <Icon className="!ml-2" color="blue" name="question circle" />
                      <span className="text-red-600">*</span>
                    </CustomTooltip>
                  </label>
                  <ContentInput
                    activeVersion={0}
                    error={errors.content}
                    touched={touched.content}
                    value={values.content}
                    onChange={(newContent): void => setFieldValue('content', newContent)}
                  />
                </div>

                {publicRuntimeConfig.s3root && (
                  <div className="mb-4 questionInput questionFiles">
                    <h2 className="!text-xl !mb-2">
                      <FormattedMessage defaultMessage="Attached Images" id="createQuestion.filesLabel" />
                    </h2>
                    <FileDropzone
                      files={values.files}
                      onChangeFiles={(newFiles): void => setFieldValue('files', newFiles)}
                    />
                  </div>
                )}

                <div className="mb-4 questionInput questionOptions">
                  <OptionsInput
                    type={values.type}
                    value={values.options}
                    onChange={(newOptions): void => setFieldValue('options', newOptions)}
                  />
                </div>

                <div className="mb-4 questionPreview">
                  <h2 className="!text-xl !mb-2">
                    <FormattedMessage defaultMessage="Audience Preview" id="createQuestion.previewLabel" />
                  </h2>
                  <Preview description={values.content} options={values.options} questionType={values.type} />
                </div>
              </Form>
            </FocusLock>
          )
        }}
      </Formik>

      <style jsx>{`
        @import 'src/theme';

        .questionCreationForm :global(form) {
          @supports (grid-gap: 1rem) {
            @include desktop-tablet-only {
              display: grid;
              align-content: start;

              grid-gap: 1rem;
              grid-template-columns: repeat(3, 1fr);
              grid-template-rows: auto;
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
    </div>
  )
}

QuestionCreationForm.defaultProps = defaultProps

export default QuestionCreationForm
