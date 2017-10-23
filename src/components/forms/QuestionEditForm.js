import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash/get'
import isEmpty from 'validator/lib/isEmpty'
import { connect } from 'react-redux'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Form } from 'semantic-ui-react'

import { ContentInput, TitleInput, TagInput } from '../questions'
import {
  TypeChooser,
  SCCreationOptions,
  SCCreationPreview,
  FREECreationOptions,
  FREECreationPreview,
} from '../../components/questionTypes'
import { FREERestrictionTypes, QuestionTypes } from '../../lib'

// form validation
const validate = ({
  content, options, tags, title, type,
}) => {
  const errors = {}

  if (!title || isEmpty(title)) {
    errors.title = 'form.createQuestion.title.empty'
  }

  if (!content || isEmpty(content)) {
    errors.content = 'form.createQuestion.content.empty'
  }

  if (!tags || tags.length === 0) {
    errors.tags = 'form.createQuestion.tags.empty'
  }

  if (!type || isEmpty(type)) {
    errors.type = 'form.createQuestion.type.empty'
  }

  // validation of SC answer options
  if (type === QuestionTypes.SC) {
    // SC questions need at least one answer option to be valid
    if (!options || options.length === 0) {
      errors.options = 'form.createQuestion.options.empty'
    }
    // validation of FREE answer options
  } else if (type === QuestionTypes.FREE) {
    if (options && options.restrictions) {
      if (!options.restrictions.min && !options.restrictions.max) {
        errors.options = 'form.createQuestion.options.noMinMax'
      }

      if (options.restrictions.min >= options.restrictions.max) {
        errors.options = 'form.createQuestion.options.minGteMax'
      }
    }
  }

  return errors
}

const propTypes = {
  content: PropTypes.string.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  invalid: PropTypes.bool.isRequired,
  onDiscard: PropTypes.func.isRequired,
  options: PropTypes.object,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  ),
  title: PropTypes.string.isRequired,
  type: PropTypes.string,
}

const defaultProps = {
  options: {
    choices: [],
  },
  tags: [],
  type: QuestionTypes.SC,
}

const QuestionEditForm = ({
  intl,
  invalid,
  content,
  options,
  tags,
  title,
  type,
  handleSubmit: onSubmit,
  onDiscard,
}) => {
  const typeComponents = {
    [QuestionTypes.SC]: {
      input: SCCreationOptions,
      preview: SCCreationPreview,
    },
    [QuestionTypes.MC]: {
      input: SCCreationOptions,
      preview: SCCreationPreview,
    },
    [QuestionTypes.FREE]: {
      input: FREECreationOptions,
      preview: FREECreationPreview,
    },
  }
  const Preview = typeComponents[type].preview

  return (
    <div className="questionCreationForm">
      <Form onSubmit={onSubmit}>
        <div className="questionInput questionTitle">
          <Field name="title" component={TitleInput} />
        </div>

        <div className="questionInput questionType">
          <Field name="type" component={TypeChooser} intl={intl} />
        </div>

        <div className="questionInput questionTags">
          <Field name="tags" component={TagInput} tags={tags} />
        </div>

        <div className="questionInput questionContent">
          <Field name="content" component={ContentInput} />
        </div>

        <div className="questionInput questionOptions">
          <Field name="options" component={typeComponents[type].input} intl={intl} />
        </div>

        <div className="questionPreview">
          <Preview title={title} description={content} options={options} />
        </div>

        <Button className="discard" type="reset" onClick={onDiscard}>
          <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
        </Button>
        <Button primary className="save" disabled={invalid} type="submit">
          <FormattedMessage defaultMessage="Save" id="common.button.save" />
        </Button>
      </Form>

      <style jsx>{`
        @import 'src/theme';

        .questionEditForm > :global(form) {
          display: flex;
          flex-direction: column;

          padding: 1rem;
        }

        .questionInput,
        .questionPreview {
          margin-bottom: 1rem;
        }

        .questionInput > :global(.field > label) {
          font-size: 1.2rem;
        }

        @supports (grid-gap: 1rem) {
          @include desktop-tablet-only {
            .questionEditForm > :global(form) {
              display: grid;

              grid-gap: 1rem;
              grid-template-columns: repeat(6, 1fr);
              grid-template-rows: auto;
              grid-template-areas: 'title title title title preview preview'
                'type type tags tags preview preview'
                'content content content content content content'
                'options options options options options options';
            }

            .questionInput {
              margin-bottom: 0;
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
              margin-bottom: 0;
            }

            .questionContent {
              grid-area: content;
            }

            .questionOptions {
              grid-area: options;
            }
          }

          @include desktop-only {
            .questionEditForm > :global(form) {
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

const withState = connect(state => ({
  content: _get(state, 'form.createQuestion.values.content'),
  options: _get(state, 'form.createQuestion.values.options'),
  title: _get(state, 'form.createQuestion.values.title'),
  type: _get(state, 'form.createQuestion.values.type'),
}))

export default reduxForm({
  form: 'createQuestion',
  initialValues: {
    content: '',
    options: {
      choices: [],
      randomized: false,
      restrictions: {
        type: FREERestrictionTypes.NONE,
      },
    },
    tags: [],
    title: '',
    type: 'SC',
  },
  validate,
})(withState(QuestionEditForm))
