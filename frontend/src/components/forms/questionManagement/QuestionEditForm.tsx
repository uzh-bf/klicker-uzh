import React from 'react'
import _isEmpty from 'lodash/isEmpty'
import _isNumber from 'lodash/isNumber'
import getConfig from 'next/config'
import { EditorState, ContentState, convertFromRaw } from 'draft-js'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import { Button, Form, Dropdown, Message } from 'semantic-ui-react'
import { Formik } from 'formik'
import FocusLock, { AutoFocusInside } from 'react-focus-lock'

import FileDropzone from './FileDropzone'
import FormikInput from '../components/FormikInput'
import { generateTypesLabel } from '../../../lib/utils/lang'
import ContentInput from '../../questions/creation/ContentInput'
import TagInput from '../../questions/creation/TagInput'
import FREECreationOptions from '../../questionTypes/FREE/FREECreationOptions'
import SCCreationOptions from '../../questionTypes/SC/SCCreationOptions'
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
const validate = ({ title, content, options, tags, type }): any => {
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

interface Props {
  activeVersion: number
  editSuccess: any
  loading: boolean
  handleActiveVersionChange: any
  handleSubmit: any
  handleDiscard: () => void
  allTags: any[]
  title: string
  questionTags: any[]
  type?: string
  versions: any[]
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

function QuestionEditForm({
  activeVersion,
  editSuccess,
  loading,
  questionTags,
  title,
  type,
  allTags,
  handleSubmit,
  handleDiscard,
  handleActiveVersionChange,
  versions,
}: Props): React.ReactElement {
  const intl = useIntl()

  // if the active version would be out of array bounds, we are creating a new one
  const isNewVersion = activeVersion === versions.length

  // calculate the version with which to initialize the version fields (the current or last one)
  const initializeVersion = isNewVersion ? versions.length - 1 : activeVersion

  const initialValues = {
    content: versions[initializeVersion].content
      ? EditorState.createWithContent(convertFromRaw(JSON.parse(versions[initializeVersion].content)))
      : EditorState.createWithContent(ContentState.createFromText(versions[initializeVersion].description)),
    files: versions[initializeVersion].files || [],
    options: versions[initializeVersion].options[type] || {},
    tags: questionTags.map((tag): string => tag.name),
    title,
    type,
    versions,
  }

  const versionOptions = versions.map(({ id }, index): any => ({
    text: `v${index + 1}`,
    value: id,
  }))

  return (
    <FocusLock>
      <div className="questionEditForm">
        <Formik
          enableReinitialize
          initialValues={initialValues}
          validate={validate}
          // validationSchema={Yup.object().shape({})}
          onSubmit={handleSubmit(isNewVersion)}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            handleBlur,
            handleSubmit: handleFormSubmit,
            setFieldValue,
            setFieldTouched,
            isSubmitting,
          }: any): React.ReactElement => {
            const OptionsInput = typeComponents[type]
            const { message, success } = editSuccess

            return (
              <Form error={success === false} success={success === true} onSubmit={handleFormSubmit}>
                <div className="actionArea">
                  <Button className="discard" size="large" type="button" onClick={handleDiscard}>
                    <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
                  </Button>

                  <div className="infoMessage">
                    <Message compact success size="small">
                      <FormattedMessage defaultMessage="Successfully modified question." id="editQuestion.sucess" />
                    </Message>
                    <Message compact error size="small">
                      <FormattedMessage
                        defaultMessage="Could not modify question: {error}"
                        id="editQuestion.error"
                        values={{ error: message }}
                      />
                    </Message>
                  </div>

                  <Button
                    primary
                    className="save"
                    disabled={!_isEmpty(errors) || _isEmpty(touched)}
                    loading={loading && isSubmitting}
                    size="large"
                    type="submit"
                  >
                    <FormattedMessage defaultMessage="Save" id="common.button.save" />
                  </Button>
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
                  <AutoFocusInside>
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
                  </AutoFocusInside>
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
                      <Dropdown.Item
                        active={isNewVersion}
                        onClick={(): void => handleActiveVersionChange(versionOptions.length)}
                      >
                        {`v${versionOptions.length + 1} (draft)`}
                      </Dropdown.Item>

                      {versionOptions
                        .map(
                          ({ id, text }: any, index): React.ReactElement => (
                            <Dropdown.Item
                              active={activeVersion === index}
                              key={id}
                              onClick={(): void => handleActiveVersionChange(index)}
                            >
                              {text}
                            </Dropdown.Item>
                          )
                        )
                        .reverse()}
                    </Dropdown.Menu>
                  </Dropdown>
                </div>

                <div className="questionInput questionTags">
                  <TagInput
                    tags={allTags}
                    touched={touched.tags}
                    value={values.tags}
                    onChange={(newTags): void => {
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
                    onChange={(newContent): void => {
                      setFieldTouched('content', true, false)
                      setFieldValue('content', newContent)
                    }}
                  />
                </div>

                {publicRuntimeConfig.s3root && (
                  <div className="questionInput questionFiles">
                    <h3>
                      <FormattedMessage defaultMessage="Attached Images" id="createQuestion.filesLabel" />
                    </h3>
                    <FileDropzone
                      disabled={!isNewVersion}
                      files={values.files}
                      onChangeFiles={(newFiles): void => {
                        setFieldTouched('files', true, false)
                        setFieldValue('files', newFiles)
                      }}
                    />
                  </div>
                )}

                <div className="questionInput questionOptions">
                  <OptionsInput
                    disabled={!isNewVersion}
                    type={values.type}
                    value={values.options}
                    onChange={(newOptions): void => {
                      setFieldTouched('options', true, false)
                      setFieldValue('options', newOptions)
                    }}
                  />
                </div>
              </Form>
            )
          }}
        </Formik>

        <style jsx>{`
          @import 'src/theme';

          .questionEditForm > :global(form) {
            display: flex;
            flex-direction: column;

            .questionInput,
            .questionPreview {
              margin-bottom: 1rem;
            }

            .questionInput :global(.field > label) {
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

                margin-top: -1rem;

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
                  align-items: start;

                  :global(.message) {
                    margin-right: 1rem;
                  }
                }
              }
            }
          }
        `}</style>
      </div>
    </FocusLock>
  )
}

QuestionEditForm.defaultProps = defaultProps

export default QuestionEditForm
