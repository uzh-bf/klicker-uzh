import React from 'react'
import { PropTypes } from 'prop-types'
import { Icon } from 'semantic-ui-react'

const Feedback = ({ content, votes }) => (
  <div className="feedback">
    <div className="content">{content}</div>
    <div className="icon"><Icon name="trash outline" /></div>
    <div className="vote">+{votes}</div>
    <style jsx>{`
      .feedback {
        background: lightgrey;
        border: 1px solid;
        display: flex;
        margin-bottom: .5rem;
      }
      .feedback > .content {
        flex: 0 0 80%;
        padding: .5rem;
      }
      .feedback > .icon {
        flex: 0 0 5%;
        padding: .5rem;
      }
      .feedback > .vote {
        border-left: 1px solid;
        flex: 0 0 15%;
        padding: .5rem;
        text-align: center;
      }
    `}</style>
  </div>
)

Feedback.propTypes = {
  content: PropTypes.string.isRequired,
  votes: PropTypes.string.isRequired,
}

export default Feedback
