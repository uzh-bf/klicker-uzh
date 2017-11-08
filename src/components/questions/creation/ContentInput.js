import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Form } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
  meta: PropTypes.shape({
    dirty: PropTypes.bool,
    invalid: PropTypes.bool,
    touched: PropTypes.bool,
  }).isRequired,
}

const ContentInput = ({ input: { value, onChange }, meta: { dirty, invalid, touched } }) => (
  <div className="contentInput">
    <Form.Field required error={(dirty || touched) && invalid}>
      <label htmlFor="content">
        <FormattedMessage
          defaultMessage="Question"
          id="teacher.createQuestion.contentInput.label"
        />
        <a data-tip data-for="contentHelp">
          <FaQuestionCircle />
        </a>
      </label>

      <ReactTooltip id="contentHelp" delayHide={250} place="right">
        <FormattedMessage
          defaultMessage="Enter the question you want to ask the audience."
          id="teacher.createQuestion.contentInput.tooltip"
        />
      </ReactTooltip>

      <textarea name="content" value={value} onChange={onChange} />
    </Form.Field>

    <style jsx>{`
      @import 'src/_theme';

      .contentInput {
        @include tooltip-icon;

        textarea {
          border: 1px solid $color-borders;
          height: 20rem;
          padding: 1rem;

          &:focus {
            border-color: $color-focus;
          }
        }
      }
    `}</style>
  </div>
)

ContentInput.propTypes = propTypes

export default ContentInput
