import React from 'react'
import PropTypes from 'prop-types'
import _get from 'lodash/get'
import isEmpty from 'validator/lib/isEmpty'
import { connect } from 'react-redux'
import { Field, reduxForm } from 'redux-form'
import { intlShape, FormattedMessage } from 'react-intl'

import TitleInput from '../questions/creation/TitleInput'
import TagInput from '../questions/creation/TagInput'
import TypeChooser from '../questionTypes/TypeChooser'
import {
  SCCreationOptions,
  SCCreationPreview,
  SCCreationContent,
} from '../../components/questionTypes/SC'

// form validation
const validate = ({
  content, options, tags, title,
}) => {
  const errors = {}

  if (!title || isEmpty(title)) {
    errors.title = 'form.createQuestion.title.empty'
  }

  if (!content || isEmpty(content)) {
    errors.content = 'form.createQuestion.content.empty'
  }

  if (!options || options.length === 0) {
    errors.options = 'form.createQuestion.options.empty'
  }

  if (!tags || tags.length === 0) {
    errors.tags = 'form.createQuestion.tags.empty'
  }

  return errors
}

const propTypes = {
  content: PropTypes.string.isRequired,
  handleSubmit: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  invalid: PropTypes.bool.isRequired,
  onDiscard: PropTypes.func.isRequired,
  options: PropTypes.array,
  tags: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
    }),
  ),
  title: PropTypes.string.isRequired,
}

const defaultProps = {
  options: [],
  tags: [],
}

const QuestionCreationForm = ({
  intl,
  invalid,
  content,
  options,
  tags,
  title,
  handleSubmit: onSubmit,
  onDiscard,
}) => (
  <form className="ui form" onSubmit={onSubmit}>
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
      <Field name="content" component={SCCreationContent} />
    </div>

    <div className="questionInput questionOptions">
      <Field name="options" component={SCCreationOptions} />
    </div>

    <div className="questionPreview">
      <SCCreationPreview title={title} description={content} options={options} />
    </div>

    <button className="ui button discard" type="reset" onClick={onDiscard}>
      <FormattedMessage defaultMessage="Discard" id="common.button.discard" />
    </button>
    <button className="ui primary button save" disabled={invalid} type="submit">
      <FormattedMessage defaultMessage="Save" id="common.button.save" />
    </button>

    <style jsx>{`
      form {
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
        @media all and (min-width: 768px) {
          form {
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

          .save {
            align-self: center;
          }
        }

        @media all and (min-width: 991px) {
          form {
            margin: 0 20%;
            padding: 1rem 0;
          }
        }
      }
    `}</style>
  </form>
)

QuestionCreationForm.propTypes = propTypes
QuestionCreationForm.defaultProps = defaultProps

const withState = connect(state => ({
  content: _get(state, 'form.createQuestion.values.content'),
  options: _get(state, 'form.createQuestion.values.options'),
  title: _get(state, 'form.createQuestion.values.title'),
}))

export default reduxForm({
  form: 'createQuestion',
  validate,
})(withState(QuestionCreationForm))
