import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash/get'
import isEmpty from 'validator/lib/isEmpty'
import _isNumber from 'lodash/isNumber'
import { connect } from 'react-redux'
import { Field, reduxForm } from 'redux-form'
import { FormattedMessage, intlShape } from 'react-intl'
import { Button, Form } from 'semantic-ui-react'
import { compose } from 'recompose'

import { ContentInput, TitleInput, TagInput } from '../questions'
import {
  TypeChooser,
  SCCreationOptions,
  SCCreationPreview,
  FREECreationOptions,
  FREECreationPreview,
} from '../../components/questionTypes'
import { QUESTION_TYPES } from '../../lib'
import { QUESTION_GROUPS } from '../../constants'

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

  if (QUESTION_GROUPS.CHOICES.includes(type) && (!options || options.choices.length === 0)) {
    errors.options = 'form.createQuestion.options.empty'
  }

  // validation of SC answer options
  /* if (type === QUESTION_TYPES.SC) {
    // SC questions need at least one answer option to be valid
    if (!options || options.choices.length === 0) {
      errors.options = 'form.createQuestion.options.empty'
    } else {
      const numCorrect = options.choices.filter(option => option.correct).length
      if (numCorrect > 1) {
        // validate that only one option is correct for SC questions
        errors.options = 'form.createQuestion.options.tooManyCorrect'
      } else if (numCorrect === 0) {
        // validate that there is a correct choice
        errors.options = 'form.createQuestion.options.notEnoughCorrect'
      }
    }
    // validation of FREE answer options
  } else if (type === QUESTION_TYPES.MC) {
    // MC questions need at least one answer option to be valid
    if (!options || options.choices.length === 0) {
      errors.options = 'form.createQuestion.options.empty'
    } else {
      const numCorrect = options.choices.filter(option => option.correct).length
      if (numCorrect === 0) {
        // validate that there is at least one correct choice
        errors.options = 'form.createQuestion.options.notEnoughCorrect'
      }
    }
  } else */

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
  type: QUESTION_TYPES.SC,
}

const QuestionCreationForm = ({
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
  const Preview = typeComponents[type].preview

  return (
    <div className="questionCreationForm">
      <Form onSubmit={onSubmit}>
        <div className="questionInput questionTitle">
          <Field component={TitleInput} name="title" />
        </div>

        <div className="questionInput questionType">
          <Field component={TypeChooser} intl={intl} name="type" />
        </div>

        <div className="questionInput questionTags">
          <Field component={TagInput} name="tags" tags={tags} />
        </div>

        <div className="questionInput questionContent">
          <Field component={ContentInput} name="content" />
        </div>

        <div className="questionInput questionOptions">
          <Field component={typeComponents[type].input} intl={intl} name="options" type={type} />
        </div>

        <div className="questionPreview">
          <h2>
            <FormattedMessage
              defaultMessage="Audience Preview"
              id="teacher.createQuestion.previewLabel"
            />
          </h2>
          <Preview description={content} options={options} questionType={type} title={title} />
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
      `}</style>
    </div>
  )
}

QuestionCreationForm.propTypes = propTypes
QuestionCreationForm.defaultProps = defaultProps

export default compose(
  reduxForm({
    form: 'createQuestion',
    initialValues: {
      content: null,
      options: {
        choices: [],
        randomized: false,
        restrictions: {
          max: null,
          min: null,
        },
      },
      tags: null,
      title: null,
      type: QUESTION_TYPES.SC,
    },
    validate,
  }),
  connect(state => ({
    content: _get(state, 'form.createQuestion.values.content'),
    options: _get(state, 'form.createQuestion.values.options'),
    title: _get(state, 'form.createQuestion.values.title'),
    type: _get(state, 'form.createQuestion.values.type'),
  })),
)(QuestionCreationForm)
