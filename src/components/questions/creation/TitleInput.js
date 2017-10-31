import React from 'react'
import PropTypes from 'prop-types'
import ReactTooltip from 'react-tooltip'
import { FormattedMessage } from 'react-intl'
import { FaQuestionCircle } from 'react-icons/lib/fa'

const propTypes = {
  input: PropTypes.shape({
    onChange: PropTypes.func.isRequired,
    value: PropTypes.string.isRequired,
  }).isRequired,
}

const TitleInput = ({ input: { value, onChange } }) => (
  <div className="field">
    <label htmlFor="questionTitle">
      <FormattedMessage defaultMessage="Question title" id="teacher.createQuestion.questionTitle" />
    </label>
    <a data-tip data-for="titleHelp">
      {' '}
      <FaQuestionCircle className="icon" />
    </a>
    <input name="questionTitle" type="text" value={value} onChange={onChange} />

    <ReactTooltip id="titleHelp" delayHide={250} place="right">
      <span>Enter a short title for the question.</span>
    </ReactTooltip>

    <style jsx>{`
      @import 'src/_theme';

      :global(label) {
        display: inline !important;
      }

      a {
        color: gray;

        :global(.icon) {
          font-size: 1.25rem;
          margin-bottom: 0.2rem;
        }
      }
    `}</style>
  </div>
)

TitleInput.propTypes = propTypes

export default TitleInput
