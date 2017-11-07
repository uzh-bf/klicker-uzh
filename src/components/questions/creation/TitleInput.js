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
  <div className="field titleInput">
    <label htmlFor="questionTitle">
      <FormattedMessage
        defaultMessage="Question title"
        id="teacher.createQuestion.titleInput.label"
      />{' '}
      <a data-tip data-for="titleHelp">
        <FaQuestionCircle />
      </a>
    </label>

    <ReactTooltip id="titleHelp" delayHide={250} place="right">
      <FormattedMessage
        defaultMessage="Enter a short title for the question."
        id="teacher.createQuestion.titleInput.tooltip"
      />
    </ReactTooltip>

    <input name="questionTitle" type="text" value={value} onChange={onChange} />

    <style jsx>{`
      @import 'src/_theme';

      .titleInput {
        a {
          color: gray;

          :global(svg) {
            font-size: 1.25rem;
            margin-bottom: 0.2rem;
          }
        }
      }
    `}</style>
  </div>
)

TitleInput.propTypes = propTypes

export default TitleInput
