import React from 'react'
import PropTypes from 'prop-types'
import isEmpty from 'validator/lib/isEmpty'
import { compose, withProps } from 'recompose'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Form, Icon, Menu, Message } from 'semantic-ui-react'

import { ContentInput, TagInput, TitleInput } from '../questions'
import { FREECreationOptions, SCCreationOptions } from '../../components/questionTypes'
import { QUESTION_TYPES } from '../../constants'

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
  if (type === QUESTION_TYPES.SC) {
    // SC questions need at least one answer option to be valid
    if (!options || options.length === 0) {
      errors.options = 'form.editQuestion.options.empty'
    }
    // validation of FREE answer options
  } else if (type === QUESTION_TYPES.FREE) {
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
  activeVersion: PropTypes.number.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  invalid: PropTypes.bool.isRequired,
  isNewVersion: PropTypes.bool.isRequired,
  onActiveVersionChange: PropTypes.func.isRequired,
  onDiscard: PropTypes.func.isRequired,
  type: PropTypes.string,
  versionOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
}

const defaultProps = {
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
  isNewVersion,
  intl,
  invalid,
  type,
  handleSubmit: onSubmit,
  onActiveVersionChange,
  onDiscard,
  versionOptions,
}) => (
  <div className="questionEditForm">
    <Form onSubmit={onSubmit}>
      <div className="questionInput questionType">
        <Form.Field>
          <label htmlFor="type">
            <FormattedMessage defaultMessage="Question Type" id="teacher.editQuestion.type" />
          </label>
          <div className="type">{type}</div>
        </Form.Field>
      </div>

      <div className="questionInput questionTitle">
        <Field component={TitleInput} name="title" />
      </div>

      <div className="questionVersion">
        <h2>Question Versions</h2>

        <Message info>
          The contents of existing versions cannot be altered. Please create a new version instead.
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
            New Version
          </Menu.Item>
        </Menu>
      </div>

      <div className="questionInput questionTags">
        <Field component={TagInput} name="tags" />
      </div>

      <div className="questionInput questionContent">
        <Field component={ContentInput} disabled={!isNewVersion} name="description" />
      </div>

      <div className="questionInput questionOptions">
        <Field
          component={typeComponents[type]}
          disabled={!isNewVersion}
          intl={intl}
          name="options"
          type={type}
        />
      </div>

      <div className="actionArea">
        <Button className="discard" type="reset" onClick={onDiscard}>
          <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
        </Button>
        <Button primary className="save" disabled={invalid} type="submit">
          <FormattedMessage defaultMessage="Save" id="common.button.save" />
        </Button>
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
              'type title'
              'tags tags'
              'version version'
              'content content'
              'options options'
              'actions actions';

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
    isNewVersion, activeVersion, versions, tags, title, type,
  }) => {
    const initializeVersion = isNewVersion ? versions.length - 1 : activeVersion
    return {
      initialValues: {
        description: versions[initializeVersion].description,
        options: versions[initializeVersion].options[type],
        tags,
        title,
        type,
        versions,
      },
      versionOptions: versions.map(({ id }, index) => ({
        text: `v${index + 1}`,
        value: id,
      })),
    }
  }),
  reduxForm({
    enableReinitialize: true,
    form: 'editQuestion',
    validate,
  }),
)(QuestionEditForm)
