import React from 'react'
import PropTypes from 'prop-types'
import { compose, withProps } from 'recompose'
import _isEmpty from 'lodash/isEmpty'
import _isNumber from 'lodash/isNumber'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Form, Icon, Menu, Message } from 'semantic-ui-react'
import { Formik } from 'formik'

import { FormikInput } from '.'
import { ContentInput, TagInput } from '../questions'
import { FREECreationOptions, SCCreationOptions } from '../../components/questionTypes'
import { QUESTION_TYPES, QUESTION_GROUPS } from '../../constants'

// form validation
const validate = ({
  title, description, options, tags, type,
}) => {
  const errors = {}

  if (!title || _isEmpty(title)) {
    errors.title = 'form.editQuestion.content.empty'
  }

  if (!description || _isEmpty(description)) {
    errors.description = 'form.editQuestion.content.empty'
  }

  if (!tags || tags.length === 0) {
    errors.tags = 'form.editQuestion.tags.empty'
  }

  if (QUESTION_GROUPS.CHOICES.includes(type) && (!options || options.choices.length === 0)) {
    errors.options = 'form.createQuestion.options.empty'
  }

  if (type === QUESTION_TYPES.FREE_RANGE) {
    if (options && options.restrictions) {
      const isMinNum = _isNumber(options.restrictions.min)
      const isMaxNum = _isNumber(options.restrictions.max)

      if (isMinNum && isMaxNum && options.restrictions.min >= options.restrictions.max) {
        errors.options = 'form.createQuestion.options.minGteMax'
      }
    } else {
      errors.options = 'form.createQuestion.options.invalid'
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
    }),
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
                <FormattedMessage
                  defaultMessage="Successfully modified question."
                  id="editQuestion.sucess"
                />
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
                <div className="type">
                  <FormattedMessage defaultMessage="type" id={`common.${type}.label`} />
                </div>
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
                label={intl.formatMessage({
                  defaultMessage: 'Question Title',
                  id: 'createQuestion.titleInput.label',
                })}
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
                <FormattedMessage
                  defaultMessage="Question Versions"
                  id="editQuestion.questionVersions.title"
                />
              </h2>

              <Message info>
                <FormattedMessage
                  defaultMessage="The contents of existing versions cannot be altered. Please create a new version instead."
                  id="editQuestion.questionVersions.description"
                />
              </Message>

              <Menu stackable tabular>
                {versionOptions.map(({ id, text }, index) => (
                  <Menu.Item
                    active={activeVersion === index}
                    key={id}
                    onClick={() => onActiveVersionChange(index)}
                  >
                    {text}
                  </Menu.Item>
                ))}

                <Menu.Item
                  active={isNewVersion}
                  onClick={() => onActiveVersionChange(versionOptions.length)}
                >
                  <Icon name="plus" />
                  <FormattedMessage defaultMessage="New Version" id="editQuestion.newVersion" />
                </Menu.Item>
              </Menu>
            </div>

            <div className="questionInput questionTags">
              <TagInput
                tags={tags}
                value={values.tags}
                onChange={(newTags) => {
                  setFieldTouched('tags', true, false)
                  setFieldValue('tags', newTags)
                }}
              />
            </div>

            <div className="questionInput questionContent">
              <ContentInput
                disabled={!isNewVersion}
                error={errors.description}
                touched={touched.description}
                value={values.description}
                onChange={(newDescription) => {
                  setFieldTouched('description', true, false)
                  setFieldValue('description', newDescription)
                }}
              />
            </div>

            <div className="questionInput questionOptions">
              <OptionsInput
                disabled={!isNewVersion}
                intl={intl}
                type={values.type}
                value={values.options}
                onChange={(newOptions) => {
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
    `}</style>
  </div>
)

QuestionEditForm.propTypes = propTypes
QuestionEditForm.defaultProps = defaultProps

export default compose(
  withProps(({
    allTags, activeVersion, versions, questionTags, title, type, onSubmit,
  }) => {
    const isNewVersion = activeVersion === versions.length
    const initializeVersion = isNewVersion ? versions.length - 1 : activeVersion
    return {
      initialValues: {
        description: versions[initializeVersion].description,
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
  }),
)(QuestionEditForm)
