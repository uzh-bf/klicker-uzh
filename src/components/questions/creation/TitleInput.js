import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { Form, Input } from 'semantic-ui-react'
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

const TitleInput = ({ input: { value, onChange }, meta: { dirty, invalid, touched } }) => (
  <div className="titleInput">
    <Form.Field required error={(dirty || touched) && invalid}>
      <label htmlFor="questionTitle">
        <FormattedMessage
          defaultMessage="Question Title"
          id="teacher.createQuestion.titleInput.label"
        />
        <a data-tip data-for="titleHelp">
          <FaQuestionCircle />
        </a>
      </label>

      <ReactTooltip id="titleHelp" delayHide={250} place="right">
        <FormattedMessage
          defaultMessage="Enter a short summarizing title for the question. This is only visible to you!"
          id="teacher.createQuestion.titleInput.tooltip"
        />
      </ReactTooltip>

      <Input name="questionTitle" type="text" value={value} onChange={onChange} />
    </Form.Field>

    <style jsx>{`
      @import 'src/_theme';

      .titleInput > :global(.field) {
        @include tooltip-icon;
      }
    `}</style>
  </div>
)

TitleInput.propTypes = propTypes

export default TitleInput
