import React from 'react'
import PropTypes from 'prop-types'
import Link from 'next/link'
import isEmpty from 'validator/lib/isEmpty'
import { compose, withState, withProps } from 'recompose'
import { connect } from 'react-redux'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Form, Icon, Menu, Message } from 'semantic-ui-react'

import { ContentInput, TagInput, TitleInput } from '../questions'
import { FREECreationOptions, SCCreationOptions } from '../../components/questionTypes'
import { QUESTION_TYPES } from '../../lib'

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
  content: PropTypes.string.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  invalid: PropTypes.bool.isRequired,
  isNewVersion: PropTypes.bool.isRequired,
  onDiscard: PropTypes.func.isRequired,
  options: PropTypes.object,
  setActiveVersion: PropTypes.func.isRequired,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  ),
  title: PropTypes.string.isRequired,
  type: PropTypes.string,
  versionOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
}

const defaultProps = {
  options: {
    choices: [],
  },
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
  setActiveVersion,
  isNewVersion,
  intl,
  invalid,
  type,
  handleSubmit: onSubmit,
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
        <Menu tabular>
          {versionOptions.map(({ id, text }, index) => (
            <Menu.Item
              active={activeVersion === index}
              key={id}
              onClick={() => setActiveVersion(index)}
            >
              {text}
            </Menu.Item>
          ))}
          <Menu.Item active={isNewVersion} onClick={() => setActiveVersion(versionOptions.length)}>
            <Icon name="plus" />
            New Version
          </Menu.Item>
        </Menu>
      </div>

      <div className="questionInput questionTags">
        <Field component={TagInput} name="tags" />
      </div>

      <div className="questionInput questionContent">
        <Field component={ContentInput} disabled={!isNewVersion} name="content" />
      </div>

      <div className="questionInput questionOptions">
        <Field
          component={typeComponents[type]}
          disabled={!isNewVersion}
          intl={intl}
          name="options"
        />
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
            onClick={() => console.log('click')}
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
  withState('activeVersion', 'setActiveVersion', 0),
  withProps(({ activeVersion, versions }) => ({
    isNewVersion: activeVersion === versions.length,
    versionOptions: versions.map(({ id }, index) => ({ text: `Version ${index + 1}`, value: id })),
  })),
  connect((state, {
    versions, tags, title, type,
  }) => ({
    initialValues: {
      content: versions[versions.length - 1].description,
      options: versions[versions.length - 1].options[type],
      tags,
      title,
      type,
      versions,
    },
  })),
  reduxForm({
    enableReinitialize: true,
    form: 'editQuestion',
    validate,
  }),
)(QuestionEditForm)
